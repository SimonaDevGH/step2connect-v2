const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_USERS_TABLE || 'Step2Connect_Users';
const PHONE_INDEX = process.env.DYNAMODB_PHONE_INDEX || '';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'eu-west-2',
}));

function isAdminProfile(profile) {
  return profile?.type === 'admin';
}

function isPreviewAdminProfile(profile) {
  return isAdminProfile(profile) && profile?.adminPsw === true;
}

function isStandardProfile(profile) {
  return !!profile && (
    profile.type === 'standard' || profile.type === undefined || profile.type === ''
  );
}

async function getUserByPhone(phone, documentClient = client) {
  if (!phone) return null;

  const values = { ':phone': phone };
  const names = { '#phone': 'phone', '#type': 'type' };
  const shared = {
    TableName: TABLE_NAME,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ProjectionExpression: '#phone, firstName, userId, #type, adminPsw',
  };

  if (PHONE_INDEX) {
    const result = await documentClient.send(new QueryCommand({
      ...shared,
      IndexName: PHONE_INDEX,
      KeyConditionExpression: '#phone = :phone',
      Limit: 1,
    }));
    return result.Items?.[0] || null;
  }

  let ExclusiveStartKey;
  do {
    const result = await documentClient.send(new ScanCommand({
      ...shared,
      FilterExpression: '#phone = :phone',
      ExclusiveStartKey,
    }));
    if (result.Items?.[0]) return result.Items[0];
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return null;
}

async function setUserRoleByPhone(phone, role, documentClient = client) {
  if (!phone) throw new Error('Phone is required');
  if (!['admin', 'standard', 'fincantieri_users'].includes(role?.type)) {
    throw new Error('Role type must be admin, standard or fincantieri_users');
  }
  if (typeof role?.adminPsw !== 'boolean') {
    throw new Error('adminPsw must be a boolean');
  }

  const profile = await getUserByPhone(phone, documentClient);
  if (!profile?.userId) throw new Error('User profile not found');

  const result = await documentClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { userId: profile.userId },
    UpdateExpression: 'SET #type = :type, #adminPsw = :adminPsw',
    ConditionExpression: '#phone = :phone',
    ExpressionAttributeNames: {
      '#phone': 'phone',
      '#type': 'type',
      '#adminPsw': 'adminPsw',
    },
    ExpressionAttributeValues: {
      ':phone': phone,
      ':type': role.type,
      ':adminPsw': role.adminPsw,
    },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes || null;
}

// Il login con codice può promuovere SOLO standard (anche type assente/vuoto), anche in caso di una
// modifica concorrente del ruolo da parte dell'operatore.
async function promoteWhitelistUserByPhone(phone, documentClient = client) {
  const profile = await getUserByPhone(phone, documentClient);
  if (profile?.type === 'fincantieri_users') return profile;
  if (!isStandardProfile(profile) || !profile.userId) return null;
  try {
    const result = await documentClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userId: profile.userId },
      UpdateExpression: 'SET #type = :type',
      ConditionExpression: '#phone = :phone AND (attribute_not_exists(#type) OR #type = :empty OR #type = :standard)',
      ExpressionAttributeNames: { '#phone': 'phone', '#type': 'type' },
      ExpressionAttributeValues: {
        ':phone': phone, ':type': 'fincantieri_users', ':standard': 'standard', ':empty': '',
      },
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes || null;
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    const current = await getUserByPhone(phone, documentClient);
    return current?.type === 'fincantieri_users' ? current : null;
  }
}

module.exports = {
  getUserByPhone,
  isAdminProfile,
  isPreviewAdminProfile,
  isStandardProfile,
  setUserRoleByPhone,
  promoteWhitelistUserByPhone,
};
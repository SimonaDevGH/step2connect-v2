const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_USERS_TABLE || 'Step2Connect_Users';
const PHONE_INDEX = process.env.DYNAMODB_PHONE_INDEX || '';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'eu-west-2',
}));

async function getUserByPhone(phone) {
  if (!phone) return null;

  const values = { ':phone': phone };
  const names = { '#phone': 'phone' };
  const shared = {
    TableName: TABLE_NAME,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ProjectionExpression: '#phone, firstName, userId',
  };

  if (PHONE_INDEX) {
    const result = await client.send(new QueryCommand({
      ...shared,
      IndexName: PHONE_INDEX,
      KeyConditionExpression: '#phone = :phone',
      Limit: 1,
    }));
    return result.Items?.[0] || null;
  }

  let ExclusiveStartKey;
  do {
    const result = await client.send(new ScanCommand({
      ...shared,
      FilterExpression: '#phone = :phone',
      ExclusiveStartKey,
    }));
    if (result.Items?.[0]) return result.Items[0];
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return null;
}

module.exports = { getUserByPhone };
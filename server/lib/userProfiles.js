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
    ProjectionExpression: '#phone, firstName, userId, #type, adminPsw, sede, notificationsRead, quizResults, badges',
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

async function markNotificationsReadByPhone(phone, ids, documentClient = client) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await getUserByPhone(phone, documentClient);
    if (!profile?.userId) return [];
    const old = Array.isArray(profile.notificationsRead) ? profile.notificationsRead : [];
    const next = [...new Set([...old.filter((id) => !ids.includes(id)), ...ids])].slice(-300);
    try {
      await documentClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: { userId: profile.userId },
        UpdateExpression: 'SET #read = :next',
        ConditionExpression: 'attribute_exists(#id) AND #phone = :phone AND (attribute_not_exists(#read) OR #read = :old)',
        ExpressionAttributeNames: { '#id': 'userId', '#phone': 'phone', '#read': 'notificationsRead' },
        ExpressionAttributeValues: { ':next': next, ':phone': phone, ':old': profile.notificationsRead ?? [] },
      }));
      return next;
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  throw Object.assign(new Error('Letture modificate contemporaneamente: riprovare'), { status: 409 });
}

async function awardQuizBadgesByPhone(phone, definitions, quizzes, documentClient = client) {
  const { states } = require('./quizBadges');
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await getUserByPhone(phone, documentClient);
    if (!profile?.userId) return { badges: {}, newlyUnlockedIds: [], quizResults: {} };
    const old = profile.badges || {};
    const eligible = states(definitions, quizzes, profile.quizResults || {}, old)
      .filter((badge) => badge.eligible && !badge.unlocked);
    if (!eligible.length) return { badges: old, newlyUnlockedIds: [], quizResults: profile.quizResults || {} };
    const now = new Date().toISOString();
    const next = { ...old, ...Object.fromEntries(eligible.map((badge) => [badge.id, now])) };
    try {
      await documentClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: { userId: profile.userId },
        UpdateExpression: 'SET #badges = :next',
        ConditionExpression: `attribute_exists(#id) AND #phone = :phone AND ${profile.badges === undefined ? 'attribute_not_exists(#badges)' : '#badges = :old'}`,
        ExpressionAttributeNames: { '#id': 'userId', '#phone': 'phone', '#badges': 'badges' },
        ExpressionAttributeValues: { ':phone': phone, ':next': next, ...(profile.badges === undefined ? {} : { ':old': old }) },
      }));
      return { badges: next, newlyUnlockedIds: eligible.map((badge) => badge.id), quizResults: profile.quizResults || {} };
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  throw Object.assign(new Error('Badge modificati contemporaneamente: riprovare'), { status: 409 });
}

async function saveQuizResultByPhone(phone, quiz, answers, documentClient = client) {
  const firstAnswers = Object.fromEntries(quiz.questions.map((q) => [q.qid, answers[q.qid] === q.answer]));
  const score = Object.values(firstAnswers).filter(Boolean).length;
  const passed = score >= quiz.passThreshold;
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await getUserByPhone(phone, documentClient);
    if (!profile?.userId) return { score, passed, saved: false, progress: null, quizResults: {} };
    const old = profile.quizResults || {};
    const previous = old[quiz.id];
    const now = new Date().toISOString();
    const progress = {
      firstAnswers: previous?.firstAnswers || firstAnswers,
      firstScore: previous?.firstScore ?? score,
      bestScore: Math.max(previous?.bestScore || 0, score),
      attempts: (previous?.attempts || 0) + 1,
      passedAt: previous?.passedAt || (passed ? now : ''),
      lastAt: now,
    };
    const next = { ...old, [quiz.id]: progress };
    try {
      await documentClient.send(new UpdateCommand({
        TableName: TABLE_NAME, Key: { userId: profile.userId },
        UpdateExpression: 'SET #results = :next',
        ConditionExpression: 'attribute_exists(#id) AND #phone = :phone AND (attribute_not_exists(#results) OR #results = :old)',
        ExpressionAttributeNames: { '#id': 'userId', '#phone': 'phone', '#results': 'quizResults' },
        ExpressionAttributeValues: { ':next': next, ':phone': phone, ':old': old },
      }));
      return { score, passed, saved: true, progress, quizResults: next, previouslyPassed: Boolean(previous?.passedAt) };
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  throw Object.assign(new Error('Risultati modificati contemporaneamente: riprovare'), { status: 409 });
}

async function quizResultAggregates(quiz, documentClient = client) {
  let people = 0, passed = 0, ExclusiveStartKey;
  const counters = Object.fromEntries(quiz.questions.map((q) => [q.qid, { correct: 0, total: 0 }]));
  do {
    const page = await documentClient.send(new ScanCommand({
      TableName: TABLE_NAME, ProjectionExpression: '#results',
      ExpressionAttributeNames: { '#results': 'quizResults' }, ExclusiveStartKey,
    }));
    for (const profile of page.Items || []) {
      const result = profile.quizResults?.[quiz.id];
      if (!result) continue;
      people++;
      if (result.passedAt) passed++;
      for (const q of quiz.questions) {
        if (typeof result.firstAnswers?.[q.qid] !== 'boolean') continue;
        counters[q.qid].total++;
        if (result.firstAnswers[q.qid]) counters[q.qid].correct++;
      }
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return {
    people, passRate: people ? Math.round(passed * 100 / people) : 0,
    questions: quiz.questions.map((q) => ({
      qid: q.qid, correctRate: counters[q.qid].total ? Math.round(counters[q.qid].correct * 100 / counters[q.qid].total) : null,
      anchor: q.anchor, guideUrl: quiz.guideUrl,
    })),
  };
}

module.exports = {
  getUserByPhone,
  isAdminProfile,
  isPreviewAdminProfile,
  isStandardProfile,
  setUserRoleByPhone,
  promoteWhitelistUserByPhone,
  markNotificationsReadByPhone,
  saveQuizResultByPhone,
  awardQuizBadgesByPhone,
  quizResultAggregates,
};
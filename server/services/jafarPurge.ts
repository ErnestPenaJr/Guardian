import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

type CountMap = Record<string, number>

type PreviewResponse = {
  target: Record<string, unknown>,
  scope: 'user' | 'company',
  allowed: boolean,
  blockers: string[],
  counts: CountMap
}

type ExecuteResponse = {
  success: true,
  scope: 'user' | 'company',
  targetId: number,
  deletedCounts: CountMap
}

type BasicUser = {
  USER_ID: number
  FIRST_NAME: string | null
  LAST_NAME: string | null
  EMAIL: string
  COMPANY_ID: number | null
  STATUS: string | null
  COMPANY_NAME?: string | null
}

type BasicCompany = {
  COMPANY_ID: number
  NAME: string
}

type CountRow = { count: number | bigint }

const emptyCounts = (): CountMap => ({
  userRoles: 0,
  userWorkspaces: 0,
  companyInfo: 0,
  notifications: 0,
  invites: 0,
  noticesIssued: 0,
  noticeRecipients: 0,
  noticeReadStatus: 0,
  workProgress: 0,
  attachments: 0,
  tasks: 0,
  requests: 0,
  formInstances: 0,
  formInstanceValues: 0,
  milestones: 0,
  workspaces: 0,
  forms: 0,
  formFields: 0,
  users: 0,
  company: 0
})

const toInt = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value)
  const numeric = Number(value ?? 0)
  return Number.isNaN(numeric) ? 0 : numeric
}

const uniqueIds = (values: Array<number | null | undefined>): number[] =>
  Array.from(new Set(values.map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0)))

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`

const idsSql = (ids: number[]) => ids.join(', ')

async function countQuery(tx: TxClient, sql: string): Promise<number> {
  const rows = await tx.$queryRawUnsafe<CountRow[]>(sql)
  return toInt(rows?.[0]?.count)
}

async function idQuery(tx: TxClient, sql: string, column: string): Promise<number[]> {
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(sql)
  return uniqueIds(rows.map(row => Number(row[column])))
}

async function fetchUser(tx: TxClient, userId: number): Promise<BasicUser | null> {
  const rows = await tx.$queryRawUnsafe<BasicUser[]>(`
    SELECT TOP 1
      u.USER_ID,
      u.FIRST_NAME,
      u.LAST_NAME,
      u.EMAIL,
      TRY_CONVERT(INT, u.COMPANY_ID) AS COMPANY_ID,
      u.STATUS,
      c.NAME AS COMPANY_NAME
    FROM GUARDIAN.USERS u
    LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, u.COMPANY_ID)
    WHERE u.USER_ID = ${userId}
  `)

  return rows[0] || null
}

async function fetchCompany(tx: TxClient, companyId: number): Promise<BasicCompany | null> {
  const rows = await tx.$queryRawUnsafe<BasicCompany[]>(`
    SELECT TOP 1 COMPANY_ID, NAME
    FROM GUARDIAN.COMPANY
    WHERE COMPANY_ID = ${companyId}
  `)

  return rows[0] || null
}

async function getUserRequestIds(tx: TxClient, userId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT REQUEST_ID
      FROM GUARDIAN.REQUESTS
      WHERE REQUESTOR_ID = ${userId}
         OR ASSIGNED_ID = ${userId}
         OR CANCELLED_BY = ${userId}
         OR CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
    `,
    'REQUEST_ID'
  )
}

async function getCompanyRequestIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT REQUEST_ID
      FROM GUARDIAN.REQUESTS
      WHERE TRY_CONVERT(INT, COMPANY_ID) = ${companyId}
    `,
    'REQUEST_ID'
  )
}

async function getUserAttachmentIds(tx: TxClient, userId: number, requestIds: number[]): Promise<number[]> {
  const requestFilter = requestIds.length > 0 ? ` OR REQUEST_ID IN (${idsSql(requestIds)})` : ''
  return idQuery(
    tx,
    `
      SELECT ATTACHMENT_ID
      FROM GUARDIAN.ATTACHMENTS
      WHERE CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
         ${requestFilter}
    `,
    'ATTACHMENT_ID'
  )
}

async function getCompanyAttachmentIds(tx: TxClient, companyId: number, requestIds: number[]): Promise<number[]> {
  const requestFilter = requestIds.length > 0 ? ` OR REQUEST_ID IN (${idsSql(requestIds)})` : ''
  return idQuery(
    tx,
    `
      SELECT ATTACHMENT_ID
      FROM GUARDIAN.ATTACHMENTS
      WHERE COMPANY_ID = ${companyId}
         ${requestFilter}
    `,
    'ATTACHMENT_ID'
  )
}

async function getUserNoticeIds(tx: TxClient, userId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT NOTICE_ID
      FROM GUARDIAN.NOTICES
      WHERE ISSUED_BY_USER_ID = ${userId}
    `,
    'NOTICE_ID'
  )
}

async function getCompanyNoticeIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT NOTICE_ID
      FROM GUARDIAN.NOTICES
      WHERE COMPANY_ID = ${companyId}
    `,
    'NOTICE_ID'
  )
}

async function getUserFormInstanceIds(tx: TxClient, userId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT FORM_INSTANCE_ID
      FROM GUARDIAN.FORMS_INSTANCE
      WHERE ASSIGNED_ID = ${userId}
         OR CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
    `,
    'FORM_INSTANCE_ID'
  )
}

async function getCompanyFormInstanceIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT FORM_INSTANCE_ID
      FROM GUARDIAN.FORMS_INSTANCE
      WHERE COMPANY_ID = ${companyId}
    `,
    'FORM_INSTANCE_ID'
  )
}

async function getCompanyWorkspaceIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT WORKSPACE_ID
      FROM GUARDIAN.WORKSPACES
      WHERE COMPANY_ID = ${companyId}
    `,
    'WORKSPACE_ID'
  )
}

async function getCompanyFormIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT FORM_ID
      FROM GUARDIAN.FORMS
      WHERE COMPANY_ID = ${companyId}
    `,
    'FORM_ID'
  )
}

async function getCompanyUserIds(tx: TxClient, companyId: number): Promise<number[]> {
  return idQuery(
    tx,
    `
      SELECT USER_ID
      FROM GUARDIAN.USERS
      WHERE TRY_CONVERT(INT, COMPANY_ID) = ${companyId}
    `,
    'USER_ID'
  )
}

async function buildUserPreview(tx: TxClient, userId: number, actorUserId?: number): Promise<PreviewResponse> {
  const user = await fetchUser(tx, userId)
  if (!user) {
    throw new Error('User not found')
  }

  const requestIds = await getUserRequestIds(tx, userId)
  const attachmentIds = await getUserAttachmentIds(tx, userId, requestIds)
  const noticeIds = await getUserNoticeIds(tx, userId)
  const formInstanceIds = await getUserFormInstanceIds(tx, userId)
  const counts = emptyCounts()
  const blockers: string[] = []

  if (actorUserId && actorUserId === userId) {
    blockers.push('You cannot purge your own JAFAR account.')
  }

  counts.userRoles = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.USER_ROLES WHERE USER_ID = ${userId}`)
  counts.userWorkspaces = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.USER_WORKSPACES WHERE USER_ID = ${userId}`)
  counts.companyInfo = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY_INFO WHERE USER_ID = ${userId}`)
  counts.notifications = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTIFICATIONS WHERE USER_ID = ${userId}`)
  counts.invites = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.INVITES WHERE EMAIL = ${quote(user.EMAIL)}`)
  counts.noticeRecipients = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_RECIPIENTS WHERE RECIPIENT_USER_ID = ${userId}`)
  counts.noticeReadStatus = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_READ_STATUS WHERE USER_ID = ${userId}`)
  counts.noticesIssued = noticeIds.length
  counts.formInstances = formInstanceIds.length
  counts.formInstanceValues = formInstanceIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})`)
    : 0
  counts.attachments = attachmentIds.length
  counts.workProgress = await countQuery(
    tx,
    `
      SELECT COUNT(*) AS count
      FROM GUARDIAN.WORK_PROGRESS
      WHERE USER_ID = ${userId}
         ${requestIds.length > 0 ? `OR REQUEST_ID IN (${idsSql(requestIds)})` : ''}
         ${attachmentIds.length > 0 ? `OR RELATED_ATTACHMENT_ID IN (${idsSql(attachmentIds)})` : ''}
    `
  )
  counts.tasks = await countQuery(
    tx,
    `
      SELECT COUNT(*) AS count
      FROM GUARDIAN.TASKS
      WHERE ASSIGNED_USER_ID = ${userId}
         OR CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
         ${requestIds.length > 0 ? `OR REQUEST_ID IN (${idsSql(requestIds)})` : ''}
    `
  )
  counts.requests = requestIds.length
  counts.milestones = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID = ${userId}`)
  counts.users = 1

  return {
    target: {
      userId: user.USER_ID,
      fullName: `${user.FIRST_NAME || ''} ${user.LAST_NAME || ''}`.trim() || user.EMAIL,
      email: user.EMAIL,
      companyId: user.COMPANY_ID,
      companyName: user.COMPANY_NAME || null,
      status: user.STATUS
    },
    scope: 'user',
    allowed: blockers.length === 0,
    blockers,
    counts
  }
}

async function buildCompanyPreview(tx: TxClient, companyId: number, actorUserId?: number): Promise<PreviewResponse> {
  const company = await fetchCompany(tx, companyId)
  if (!company) {
    throw new Error('Company not found')
  }

  const userIds = await getCompanyUserIds(tx, companyId)
  const requestIds = await getCompanyRequestIds(tx, companyId)
  const attachmentIds = await getCompanyAttachmentIds(tx, companyId, requestIds)
  const noticeIds = await getCompanyNoticeIds(tx, companyId)
  const formInstanceIds = await getCompanyFormInstanceIds(tx, companyId)
  const workspaceIds = await getCompanyWorkspaceIds(tx, companyId)
  const formIds = await getCompanyFormIds(tx, companyId)
  const counts = emptyCounts()
  const blockers: string[] = []

  if (actorUserId && userIds.includes(actorUserId)) {
    blockers.push('You cannot wipe a company that contains your active JAFAR account.')
  }

  counts.users = userIds.length
  counts.company = 1
  counts.userRoles = userIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.USER_ROLES WHERE USER_ID IN (${idsSql(userIds)})`)
    : 0
  counts.userWorkspaces = workspaceIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.USER_WORKSPACES WHERE WORKSPACE_ID IN (${idsSql(workspaceIds)})`)
    : 0
  counts.companyInfo = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.COMPANY_INFO WHERE COMPANY_ID = ${companyId}`)
  counts.notifications = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTIFICATIONS WHERE COMPANY_ID = ${companyId}`)
  counts.invites = await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.INVITES WHERE COMPANY_ID = ${companyId}`)
  counts.noticeRecipients = noticeIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_RECIPIENTS WHERE NOTICE_ID IN (${idsSql(noticeIds)}) OR COMPANY_ID = ${companyId}`)
    : 0
  counts.noticeReadStatus = noticeIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.NOTICE_READ_STATUS WHERE NOTICE_ID IN (${idsSql(noticeIds)}) OR COMPANY_ID = ${companyId}`)
    : 0
  counts.noticesIssued = noticeIds.length
  counts.formInstances = formInstanceIds.length
  counts.formInstanceValues = formInstanceIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_INSTANCE_VALUES WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})`)
    : 0
  counts.attachments = attachmentIds.length
  counts.workProgress = await countQuery(
    tx,
    `
      SELECT COUNT(*) AS count
      FROM GUARDIAN.WORK_PROGRESS
      WHERE COMPANY_ID = ${companyId}
         ${requestIds.length > 0 ? `OR REQUEST_ID IN (${idsSql(requestIds)})` : ''}
         ${userIds.length > 0 ? `OR USER_ID IN (${idsSql(userIds)})` : ''}
         ${attachmentIds.length > 0 ? `OR RELATED_ATTACHMENT_ID IN (${idsSql(attachmentIds)})` : ''}
    `
  )
  counts.tasks = requestIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.TASKS WHERE REQUEST_ID IN (${idsSql(requestIds)})`)
    : 0
  counts.requests = requestIds.length
  counts.milestones = userIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.MILESTONES WHERE EVENT_USER_ID IN (${idsSql(userIds)})`)
    : 0
  counts.workspaces = workspaceIds.length
  counts.forms = formIds.length
  counts.formFields = formIds.length > 0
    ? await countQuery(tx, `SELECT COUNT(*) AS count FROM GUARDIAN.FORMS_FIELDS WHERE FORM_ID IN (${idsSql(formIds)})`)
    : 0

  return {
    target: {
      companyId: company.COMPANY_ID,
      companyName: company.NAME
    },
    scope: 'company',
    allowed: blockers.length === 0,
    blockers,
    counts
  }
}

async function executeUserPurge(tx: TxClient, userId: number, actorUserId?: number): Promise<ExecuteResponse> {
  const preview = await buildUserPreview(tx, userId, actorUserId)
  if (!preview.allowed) {
    throw new Error(preview.blockers[0] || 'User purge is blocked')
  }

  const requestIds = await getUserRequestIds(tx, userId)
  const attachmentIds = await getUserAttachmentIds(tx, userId, requestIds)
  const noticeIds = await getUserNoticeIds(tx, userId)
  const formInstanceIds = await getUserFormInstanceIds(tx, userId)
  const counts = emptyCounts()
  const userEmail = String(preview.target.email || '')

  if (noticeIds.length > 0) {
    counts.noticeRecipients += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICE_RECIPIENTS
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
    counts.noticeReadStatus += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICE_READ_STATUS
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
    counts.noticesIssued += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICES
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
  }

  counts.noticeRecipients += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.NOTICE_RECIPIENTS
    WHERE RECIPIENT_USER_ID = ${userId}
  `)
  counts.noticeReadStatus += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.NOTICE_READ_STATUS
    WHERE USER_ID = ${userId}
  `)
  counts.notifications += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.NOTIFICATIONS
    WHERE USER_ID = ${userId}
  `)
  counts.invites += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.INVITES
    WHERE EMAIL = ${quote(userEmail)}
  `)

  if (formInstanceIds.length > 0) {
    counts.formInstanceValues += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES
      WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})
    `)
    counts.formInstances += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS_INSTANCE
      WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})
    `)
  }

  if (requestIds.length > 0 || attachmentIds.length > 0) {
    const workProgressWhere: string[] = [`USER_ID = ${userId}`]
    if (requestIds.length > 0) workProgressWhere.push(`REQUEST_ID IN (${idsSql(requestIds)})`)
    if (attachmentIds.length > 0) workProgressWhere.push(`RELATED_ATTACHMENT_ID IN (${idsSql(attachmentIds)})`)
    counts.workProgress += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.WORK_PROGRESS
      WHERE ${workProgressWhere.join(' OR ')}
    `)
  } else {
    counts.workProgress += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.WORK_PROGRESS
      WHERE USER_ID = ${userId}
    `)
  }

  counts.milestones += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.MILESTONES
    WHERE EVENT_USER_ID = ${userId}
  `)

  if (requestIds.length > 0) {
    counts.tasks += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.TASKS
      WHERE REQUEST_ID IN (${idsSql(requestIds)})
         OR ASSIGNED_USER_ID = ${userId}
         OR CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
    `)
  } else {
    counts.tasks += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.TASKS
      WHERE ASSIGNED_USER_ID = ${userId}
         OR CREATE_USER_ID = ${userId}
         OR UPDATE_USER_ID = ${userId}
    `)
  }

  if (attachmentIds.length > 0) {
    counts.attachments += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.ATTACHMENTS
      WHERE ATTACHMENT_ID IN (${idsSql(attachmentIds)})
    `)
  }

  if (requestIds.length > 0) {
    counts.requests += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.REQUESTS
      WHERE REQUEST_ID IN (${idsSql(requestIds)})
    `)
  }

  counts.userWorkspaces += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.USER_WORKSPACES
    WHERE USER_ID = ${userId}
  `)
  counts.companyInfo += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.COMPANY_INFO
    WHERE USER_ID = ${userId}
  `)
  counts.userRoles += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.USER_ROLES
    WHERE USER_ID = ${userId}
  `)
  await tx.uSERS.delete({ where: { USER_ID: userId } })
  counts.users = 1

  return {
    success: true,
    scope: 'user',
    targetId: userId,
    deletedCounts: counts
  }
}

async function executeCompanyPurge(tx: TxClient, companyId: number, actorUserId?: number): Promise<ExecuteResponse> {
  const preview = await buildCompanyPreview(tx, companyId, actorUserId)
  if (!preview.allowed) {
    throw new Error(preview.blockers[0] || 'Company wipe is blocked')
  }

  const userIds = await getCompanyUserIds(tx, companyId)
  const requestIds = await getCompanyRequestIds(tx, companyId)
  const attachmentIds = await getCompanyAttachmentIds(tx, companyId, requestIds)
  const noticeIds = await getCompanyNoticeIds(tx, companyId)
  const formInstanceIds = await getCompanyFormInstanceIds(tx, companyId)
  const workspaceIds = await getCompanyWorkspaceIds(tx, companyId)
  const formIds = await getCompanyFormIds(tx, companyId)
  const counts = emptyCounts()

  if (noticeIds.length > 0) {
    counts.noticeRecipients += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICE_RECIPIENTS
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
    counts.noticeReadStatus += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICE_READ_STATUS
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
    counts.noticesIssued += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.NOTICES
      WHERE NOTICE_ID IN (${idsSql(noticeIds)})
    `)
  }

  counts.notifications += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.NOTIFICATIONS
    WHERE COMPANY_ID = ${companyId}
  `)
  counts.invites += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.INVITES
    WHERE COMPANY_ID = ${companyId}
  `)

  if (formInstanceIds.length > 0) {
    counts.formInstanceValues += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS_INSTANCE_VALUES
      WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})
    `)
    counts.formInstances += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS_INSTANCE
      WHERE FORM_INSTANCE_ID IN (${idsSql(formInstanceIds)})
    `)
  }

  const workProgressClauses = [`COMPANY_ID = ${companyId}`]
  if (requestIds.length > 0) workProgressClauses.push(`REQUEST_ID IN (${idsSql(requestIds)})`)
  if (userIds.length > 0) workProgressClauses.push(`USER_ID IN (${idsSql(userIds)})`)
  if (attachmentIds.length > 0) workProgressClauses.push(`RELATED_ATTACHMENT_ID IN (${idsSql(attachmentIds)})`)
  counts.workProgress += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.WORK_PROGRESS
    WHERE ${workProgressClauses.join(' OR ')}
  `)

  if (userIds.length > 0) {
    counts.milestones += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.MILESTONES
      WHERE EVENT_USER_ID IN (${idsSql(userIds)})
    `)
  }

  if (requestIds.length > 0) {
    counts.tasks += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.TASKS
      WHERE REQUEST_ID IN (${idsSql(requestIds)})
    `)
  }

  if (attachmentIds.length > 0) {
    counts.attachments += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.ATTACHMENTS
      WHERE ATTACHMENT_ID IN (${idsSql(attachmentIds)})
    `)
  }

  if (requestIds.length > 0) {
    counts.requests += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.REQUESTS
      WHERE REQUEST_ID IN (${idsSql(requestIds)})
    `)
  }

  if (workspaceIds.length > 0) {
    counts.userWorkspaces += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.USER_WORKSPACES
      WHERE WORKSPACE_ID IN (${idsSql(workspaceIds)})
    `)
    counts.workspaces += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.WORKSPACES
      WHERE WORKSPACE_ID IN (${idsSql(workspaceIds)})
    `)
  }

  counts.companyInfo += await tx.$executeRawUnsafe(`
    DELETE FROM GUARDIAN.COMPANY_INFO
    WHERE COMPANY_ID = ${companyId}
  `)

  if (formIds.length > 0) {
    counts.formFields += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS_FIELDS
      WHERE FORM_ID IN (${idsSql(formIds)})
    `)
    counts.forms += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.FORMS
      WHERE FORM_ID IN (${idsSql(formIds)})
    `)
  }

  if (userIds.length > 0) {
    counts.userRoles += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.USER_ROLES
      WHERE USER_ID IN (${idsSql(userIds)})
    `)
    counts.users += await tx.$executeRawUnsafe(`
      DELETE FROM GUARDIAN.USERS
      WHERE USER_ID IN (${idsSql(userIds)})
    `)
  }

  await tx.cOMPANY.delete({ where: { COMPANY_ID: companyId } })
  counts.company = 1

  return {
    success: true,
    scope: 'company',
    targetId: companyId,
    deletedCounts: counts
  }
}

export async function getJafarUsers(query?: string) {
  const safeFilter = query?.trim()
    ? `
        AND (
          u.EMAIL LIKE ${quote(`%${query.trim()}%`)}
          OR CONCAT(COALESCE(u.FIRST_NAME, ''), ' ', COALESCE(u.LAST_NAME, '')) LIKE ${quote(`%${query.trim()}%`)}
        )
      `
    : ''

  return prisma.$queryRawUnsafe<Array<{
    USER_ID: number,
    FIRST_NAME: string | null,
    LAST_NAME: string | null,
    EMAIL: string,
    COMPANY_ID: number | null,
    STATUS: string | null,
    COMPANY_NAME: string | null
  }>>(`
    SELECT TOP 250
      u.USER_ID,
      u.FIRST_NAME,
      u.LAST_NAME,
      u.EMAIL,
      TRY_CONVERT(INT, u.COMPANY_ID) AS COMPANY_ID,
      u.STATUS,
      c.NAME AS COMPANY_NAME
    FROM GUARDIAN.USERS u
    LEFT JOIN GUARDIAN.COMPANY c ON c.COMPANY_ID = TRY_CONVERT(INT, u.COMPANY_ID)
    WHERE 1 = 1
      ${safeFilter}
    ORDER BY u.EMAIL ASC
  `)
}

export async function getJafarCompanies(query?: string) {
  const safeFilter = query?.trim()
    ? `AND c.NAME LIKE ${quote(`%${query.trim()}%`)}`
    : ''

  return prisma.$queryRawUnsafe<Array<{
    COMPANY_ID: number,
    NAME: string,
    USER_COUNT: number | bigint
  }>>(`
    SELECT TOP 250
      c.COMPANY_ID,
      c.NAME,
      COUNT(u.USER_ID) AS USER_COUNT
    FROM GUARDIAN.COMPANY c
    LEFT JOIN GUARDIAN.USERS u ON TRY_CONVERT(INT, u.COMPANY_ID) = c.COMPANY_ID
    WHERE 1 = 1
      ${safeFilter}
    GROUP BY c.COMPANY_ID, c.NAME
    ORDER BY c.NAME ASC
  `)
}

export async function previewUserPurge(userId: number, actorUserId?: number) {
  return prisma.$transaction((tx) => buildUserPreview(tx as unknown as TxClient, userId, actorUserId))
}

export async function previewCompanyPurge(companyId: number, actorUserId?: number) {
  return prisma.$transaction((tx) => buildCompanyPreview(tx as unknown as TxClient, companyId, actorUserId))
}

export async function purgeUser(userId: number, actorUserId?: number) {
  return prisma.$transaction((tx) => executeUserPurge(tx as unknown as TxClient, userId, actorUserId))
}

export async function purgeCompany(companyId: number, actorUserId?: number) {
  return prisma.$transaction((tx) => executeCompanyPurge(tx as unknown as TxClient, companyId, actorUserId))
}

export type { PreviewResponse, ExecuteResponse }

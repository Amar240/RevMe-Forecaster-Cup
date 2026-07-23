import type { ImportAiPolicy, ImportDiagnostic, ImportDiagnosticCode, ImportDiagnosticTarget, ImportResolutionAction, ImportScope } from './diagnostics'

type Definition = { scope: ImportScope; title: string; explanation: string; resolution: ImportResolutionAction; editable: boolean; aiPolicy: ImportAiPolicy }
const d = (scope: ImportScope, title: string, explanation: string, resolution: ImportResolutionAction, editable = false, aiPolicy: ImportAiPolicy = 'NEVER'): Definition => ({ scope, title, explanation, resolution, editable, aiPolicy })

export const IMPORT_DIAGNOSTIC_CATALOG = {
  FILE_REQUIRED: d('FILE', 'Choose a roster file', 'Select a CSV or Excel roster before continuing.', 'REPLACE_FILE'),
  FILE_EMPTY: d('FILE', 'This file is empty', 'Choose a roster that contains headers and at least one team row.', 'REPLACE_FILE'),
  FILE_TOO_LARGE: d('FILE', 'This file is too large', 'Roster files must be 10 MB or smaller.', 'REPLACE_FILE'),
  FILE_UNSUPPORTED: d('FILE', 'This file type is not supported', 'Use a CSV or Excel Workbook (.xlsx) file.', 'REPLACE_FILE'),
  FILE_TEMPORARY: d('FILE', 'This is an Excel temporary file', 'Close Excel and choose the roster whose filename does not begin with ~$.', 'REPLACE_FILE'),
  FILE_CONTENT_MISMATCH: d('FILE', 'The filename does not match the file contents', 'Export or save the roster again in the selected CSV or .xlsx format.', 'REPLACE_FILE'),
  CSV_BINARY: d('FILE', 'This CSV contains non-text data', 'Export the roster as a UTF-8 CSV and upload the new copy.', 'REPLACE_FILE'),
  CSV_ENCODING_UNSUPPORTED: d('FILE', 'This CSV uses an unsupported encoding', 'Export the roster as UTF-8 CSV and upload the new copy.', 'REPLACE_FILE'),
  WORKBOOK_UNREADABLE: d('WORKBOOK', 'We could not read this workbook', 'The Excel file may be damaged or incomplete. Save it again as .xlsx or use a fresh RevME template.', 'DOWNLOAD_TEMPLATE'),
  WORKBOOK_UNSAFE: d('WORKBOOK', 'This workbook cannot be processed safely', 'The archive contains unsupported or unusually large content. Save only the registration worksheet into a new .xlsx file.', 'REPLACE_FILE'),
  LAYOUT_UNRECOGNIZED: d('LAYOUT', 'RevME could not recognize these columns', 'Map the uploaded columns to the required RevME roster fields or start from the template.', 'MAP_COLUMNS', true, 'EXPLAIN_ONLY'),
  LAYOUT_REQUIRED_COLUMNS_MISSING: d('LAYOUT', 'Required roster columns are missing', 'Add or map the university, team ID, and corresponding member fields.', 'MAP_COLUMNS', true, 'EXPLAIN_ONLY'),
  METADATA_TEAM_COUNT_MISMATCH: d('METADATA', 'Declared team count differs from the rows found', 'Review the workbook metadata and team rows before importing.', 'EDIT_FIELD', true, 'EXPLAIN_ONLY'),
  METADATA_INSTRUCTOR_MISMATCH: d('METADATA', 'Instructor email differs from the uploader', 'Check that this is the correct roster for your account.', 'NONE', false, 'EXPLAIN_ONLY'),
  UNIVERSITY_REQUIRED: d('UNIVERSITY', 'University is required', 'Enter the university associated with this team.', 'EDIT_FIELD', true),
  UNIVERSITY_UNKNOWN: d('UNIVERSITY', 'University was not recognized', 'Use the university registered in RevME or contact an administrator.', 'CONTACT_ADMIN'),
  UNIVERSITY_MISMATCH: d('UNIVERSITY', 'University does not match your account', 'Supervisors may import teams only for their own university.', 'CONTACT_ADMIN'),
  TEAM_ID_REQUIRED: d('TEAM', 'Team ID is required', 'Enter a unique identifier for this team.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  TEAM_ID_DUPLICATE_FILE: d('DUPLICATE', 'Team ID appears more than once', 'Give each team row a different team ID or remove the duplicate row.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  TEAM_ID_DUPLICATE_SEASON: d('DUPLICATE', 'Team ID is already used this season', 'Choose a different team ID or ask an administrator to review the existing team.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  TEAM_NAME_REQUIRED: d('TEAM', 'Team name is required', 'Enter a name for this team.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  TEAM_NAME_DUPLICATE_FILE: d('DUPLICATE', 'Team name appears more than once', 'Give each team a distinct name.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  TEAM_NAME_DUPLICATE_SEASON: d('DUPLICATE', 'Team name is already used this season', 'Choose a different team name.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  PERSON_EMAIL_REQUIRED: d('PERSON', 'Student email is required', 'Enter the student university email address or remove the empty member.', 'EDIT_FIELD', true),
  PERSON_EMAIL_MALFORMED: d('PERSON', 'This email looks incomplete', 'Check the address and include a complete domain such as student@university.edu.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  PERSON_GLUED_NAME: d('PERSON', 'This name may need to be split', 'Review the first and last name fields.', 'EDIT_FIELD', true, 'SUGGEST_EDIT'),
  PERSON_NAME_MISMATCH: d('ACCOUNT', 'Uploaded name differs from the existing account', 'Review the match. Existing account details will not be overwritten.', 'NONE', false, 'EXPLAIN_ONLY'),
  PERSON_DUPLICATE_TEAM: d('DUPLICATE', 'Student appears more than once on this team', 'Keep this email in only one member position.', 'EDIT_FIELD', true),
  PERSON_DUPLICATE_FILE: d('DUPLICATE', 'Student appears on multiple uploaded teams', 'Keep the student on only one included team.', 'REMOVE_ROW'),
  PERSON_ROLE_INVALID: d('ACCOUNT', 'This account is not a student', 'Use a student account or contact an administrator.', 'CONTACT_ADMIN'),
  PERSON_UNIVERSITY_MISMATCH: d('UNIVERSITY', 'Student belongs to another university', 'Use a student from the team university or contact an administrator.', 'CONTACT_ADMIN'),
  MEMBERSHIP_CONFLICT: d('MEMBERSHIP', 'Student already belongs to a team this season', 'Remove the student or ask an administrator to review the existing membership.', 'CONTACT_ADMIN', false, 'EXPLAIN_ONLY'),
  TEAM_MEMBER_MINIMUM: d('TEAM', 'At least one student is required', 'Add a corresponding team member email.', 'EDIT_FIELD', true),
  TEAM_MEMBER_MAXIMUM: d('CAPACITY', 'This team has too many students', 'Remove members until the team has no more than five students.', 'REMOVE_ROW'),
  SUPERVISOR_REQUIRED: d('ACCOUNT', 'Supervisor email is required', 'Enter the supervisor account email.', 'EDIT_FIELD', true),
  SUPERVISOR_NOT_FOUND: d('ACCOUNT', 'Supervisor account was not found', 'Check the email or ask an administrator to create the supervisor.', 'CONTACT_ADMIN'),
  SUPERVISOR_ROLE_INVALID: d('ACCOUNT', 'This account is not a supervisor', 'Use a supervisor account.', 'CONTACT_ADMIN'),
  SUPERVISOR_UNIVERSITY_MISMATCH: d('UNIVERSITY', 'Supervisor belongs to another university', 'Use a supervisor from the team university.', 'CONTACT_ADMIN'),
  SUPERVISOR_AMBIGUOUS: d('ACCOUNT', 'RevME could not select one supervisor', 'Add a supervisor email or ask an administrator to review the university accounts.', 'CONTACT_ADMIN'),
  CAPACITY_REACHED: d('CAPACITY', 'Supervisor team limit has been reached', 'Contact an administrator before importing more teams.', 'CONTACT_ADMIN', false, 'EXPLAIN_ONLY'),
  SEASON_UNAVAILABLE: d('SEASON', 'Team import is not available yet', 'An administrator must create or activate a competition season.', 'CONTACT_ADMIN'),
  SEASON_REGISTRATION_CLOSED: d('SEASON', 'Team registration is closed', 'Ask an administrator whether registration can be reopened.', 'CONTACT_ADMIN'),
  STALE_FILE_HASH: d('STALE_HASH', 'The roster changed after preview', 'Preview the current file again before confirming.', 'RETRY'),
  AUTH_FORBIDDEN: d('AUTH', 'You cannot perform this import action', 'Sign in with an authorized supervisor or administrator account.', 'NONE'),
  UNKNOWN_IMPORT_ERROR: d('FILE', 'RevME could not validate this roster', 'Review the details, try again, or contact an administrator.', 'RETRY', false, 'EXPLAIN_ONLY'),
} satisfies Record<ImportDiagnosticCode, Definition>

function provenanceTarget(provenance?: string): ImportDiagnosticTarget | undefined {
  if (!provenance) return undefined
  const rowNumber = Number(provenance.match(/^Row (\d+)/)?.[1]) || undefined
  const label = provenance.split(' · ')[1]
  const columnLabel = label && ['Team', 'Corresponding Team Member', 'Additional Member 1', 'Additional Member 2', 'Additional Member 3', 'Additional Member 4'].includes(label) ? label as ImportDiagnosticTarget['columnLabel'] : undefined
  return rowNumber || columnLabel ? { rowNumber, columnLabel } : undefined
}

export function createImportDiagnostic(code: ImportDiagnosticCode, legacyMessage: string, severity: 'ERROR' | 'WARNING' = 'ERROR', options: { provenance?: string; target?: ImportDiagnosticTarget } = {}): ImportDiagnostic {
  const definition = IMPORT_DIAGNOSTIC_CATALOG[code]
  return { code, severity, ...definition, target: options.target ?? provenanceTarget(options.provenance), provenance: options.provenance, legacyMessage }
}

export function diagnosticForLegacyMessage(message: string, severity: 'ERROR' | 'WARNING' = 'ERROR') {
  const split = message.indexOf(':')
  const provenance = split > 0 && /^Row \d+ · /.test(message) ? message.slice(0, split) : undefined
  const body = (split > 0 && provenance ? message.slice(split + 1) : message).trim()
  const rules: Array<[RegExp, ImportDiagnosticCode, ImportDiagnosticTarget['field']?]> = [
    [/possible glued name/i, 'PERSON_GLUED_NAME', 'lastName'], [/uploaded name .*existing account|name differs/i, 'PERSON_NAME_MISMATCH'],
    [/University is required/i, 'UNIVERSITY_REQUIRED', 'universityName'], [/could not be matched to an existing university/i, 'UNIVERSITY_UNKNOWN'], [/Institution must match/i, 'UNIVERSITY_MISMATCH'],
    [/Team identifier is required/i, 'TEAM_ID_REQUIRED', 'teamExternalId'], [/Team identifier appears more than once/i, 'TEAM_ID_DUPLICATE_FILE', 'teamExternalId'], [/Team identifier is already used/i, 'TEAM_ID_DUPLICATE_SEASON', 'teamExternalId'],
    [/Team name is required/i, 'TEAM_NAME_REQUIRED', 'teamName'], [/Team name appears more than once/i, 'TEAM_NAME_DUPLICATE_FILE', 'teamName'], [/team with this name already exists/i, 'TEAM_NAME_DUPLICATE_SEASON', 'teamName'],
    [/(Submitter|Student) email is required/i, 'PERSON_EMAIL_REQUIRED', 'email'], [/(Submitter|Student) email is not valid/i, 'PERSON_EMAIL_MALFORMED', 'email'],
    [/Duplicate team member email/i, 'PERSON_DUPLICATE_TEAM', 'email'], [/also appears at/i, 'PERSON_DUPLICATE_FILE', 'email'], [/At least one student email/i, 'TEAM_MEMBER_MINIMUM', 'email'], [/at most \d+ students/i, 'TEAM_MEMBER_MAXIMUM'],
    [/User is not a student/i, 'PERSON_ROLE_INVALID'], [/Student must belong to the same university/i, 'PERSON_UNIVERSITY_MISMATCH'], [/already assigned to/i, 'MEMBERSHIP_CONFLICT'],
    [/Supervisor email is required/i, 'SUPERVISOR_REQUIRED', 'email'], [/Supervisor not found|Uploading supervisor account could not be resolved/i, 'SUPERVISOR_NOT_FOUND'], [/User is not a supervisor/i, 'SUPERVISOR_ROLE_INVALID'], [/Supervisor must belong to the same university/i, 'SUPERVISOR_UNIVERSITY_MISMATCH'], [/matches multiple supervisors|could not be matched to a supervisor/i, 'SUPERVISOR_AMBIGUOUS'], [/maximum of \d+ teams/i, 'CAPACITY_REACHED'],
    [/declares \d+ teams/i, 'METADATA_TEAM_COUNT_MISMATCH'], [/instructor email .* differs/i, 'METADATA_INSTRUCTOR_MISMATCH'],
  ]
  const match = rules.find(([pattern]) => pattern.test(body))
  const target = provenanceTarget(provenance) ?? (match?.[2] ? {} : undefined)
  if (target && match?.[2]) {
    target.field = match[2]
    if (match[2] === 'teamName' || match[2] === 'teamExternalId' || match[2] === 'universityName') target.columnLabel = 'Team'
  }
  return createImportDiagnostic(match?.[1] ?? 'UNKNOWN_IMPORT_ERROR', message, severity, { provenance, target })
}

export function importErrorDetails(code: ImportDiagnosticCode, message: string) { return { importDiagnostics: [createImportDiagnostic(code, message)] } }

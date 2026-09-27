export const ORG_STATUSES = [
  "PENDING_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_ROLES = [
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "ORGANIZATION_EDITOR",
  "ORGANIZATION_VIEWER",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const PROGRAM_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const CERT_STATUSES = ["VALID", "REVOKED", "EXPIRED", "REISSUED"] as const;
export type CertificateStatus = (typeof CERT_STATUSES)[number];

export const JOB_STATUSES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMAIL_STATUSES = ["QUEUED", "SENT", "DELIVERED", "FAILED", "BOUNCED"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "SUCCESS",
  "REJECTED",
  "CLARIFICATION",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type ElementType =
  | "text"
  | "variable"
  | "rect"
  | "line"
  | "image"
  | "qr"
  | "signature";

export type CertElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  opacity: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  src?: string;
};

export type CertLayout = {
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  background: string;
  backgroundImage?: string;
  elements: CertElement[];
};

export type PlanLimits = {
  monthlyCertificates: number;
  monthlyEmails: number;
  maxStudents: number;
  maxPrograms: number;
  maxTemplates: number;
  maxTeamMembers: number;
  storageMb: number;
  advancedAnalytics: boolean;
  aiGeneration: boolean;
  customBranding: boolean;
  bulkOperations: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  whiteLabel: boolean;
};

export type WorkspaceSnapshot = {
  userId: string;
  email: string | null;
  name: string;
  isPlatformAdmin: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: OrgStatus;
    logoUrl: string | null;
    officialEmail: string | null;
    phone: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    contactPerson: string | null;
    description: string | null;
    brandColor: string | null;
    rejectionReason: string | null;
    role: OrgRole;
  } | null;
  needsOnboarding: boolean;
  subscription: {
    planId: string;
    planName: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
    limits: PlanLimits;
  } | null;
  usage: {
    certificates: number;
    emails: number;
    students: number;
    programs: number;
    templates: number;
    members: number;
  };
};

export const BUILTIN_VARIABLES = [
  "student_name",
  "student_id",
  "student_email",
  "college",
  "course_name",
  "branch",
  "batch",
  "registration_number",
  "program_name",
  "program_type",
  "organization_name",
  "start_date",
  "end_date",
  "duration",
  "issue_date",
  "certificate_id",
  "verification_url",
  "mentor_name",
  "certificate_title",
  "location",
] as const;

export type BuiltinVariable = (typeof BUILTIN_VARIABLES)[number];

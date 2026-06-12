export type CandidateStatus =
  | "new"
  | "shortlisted"
  | "interview_scheduled"
  | "interviewed"
  | "offered"
  | "accepted"
  | "rejected"
  | "hired"
  | "archived";

export interface Candidate {
  _id: string;
  companyId: string;
  branchId: string;
  position: string;
  department?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  resumeUrl?: string;
  status: CandidateStatus;
  interviewSchedule?: {
    date?: string;
    time?: string;
    mode?: string;
    interviewerId?: string;
    meetingLink?: string;
    feedback?: string;
    rating?: number;
  };
  offerDetails?: {
    salary?: number;
    joiningDate?: string;
    benefits?: string;
    status?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const BLOCKER_REASON_LABELS: Record<string, string> = {
  PART: "Waiting on part",
  CUSTOMER_APPROVAL: "Waiting on customer approval",
  INSURANCE_WARRANTY_APPROVAL: "Waiting on insurance/warranty approval",
  OTHER_FLOOR: "Waiting on another floor",
  OTHER: "Other",
};

export const FLOOR_LABELS: Record<number, string> = {
  1: "Floor 1 — Quick mechanic",
  2: "Floor 2 — Hard mechanic",
  3: "Floor 3 — Paint",
  4: "Floor 4 — Body",
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  PAID: "Paid",
  WARRANTY: "Warranty",
  INSURANCE: "Insurance",
};

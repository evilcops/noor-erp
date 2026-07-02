import type { EmployeeGender, FamilyMember, FamilyRelationship } from "@/types/employee";

export const MAX_MOTHER = 1;
export const MAX_FATHER = 1;

export const FAMILY_RELATIONSHIP_OPTIONS: { value: FamilyRelationship; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
];

export const FAMILY_RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Spouse",
  son: "Son",
  daughter: "Daughter",
  father: "Father",
  mother: "Mother",
  parents: "Parent",
};

export function getFamilyRelationshipLabel(relationship: string): string {
  return FAMILY_RELATIONSHIP_LABELS[relationship] ?? relationship;
}

export function maxSpousesForGender(gender?: EmployeeGender | ""): number {
  if (gender === "male") return 4;
  if (gender === "female") return 1;
  return 0;
}

export function countFamilyRelationship(
  members: Pick<FamilyMember, "relationship">[],
  relationship: FamilyRelationship,
  excludeIdx?: number
): number {
  return members.filter((m, i) => i !== excludeIdx && m.relationship === relationship).length;
}

export function canSetFamilyRelationship(
  members: Pick<FamilyMember, "relationship">[],
  memberIdx: number,
  relationship: FamilyRelationship,
  gender?: EmployeeGender | ""
): boolean {
  if (relationship === "spouse") {
    return countFamilyRelationship(members, "spouse", memberIdx) < maxSpousesForGender(gender);
  }
  if (relationship === "mother") {
    return countFamilyRelationship(members, "mother", memberIdx) < MAX_MOTHER;
  }
  if (relationship === "father") {
    return countFamilyRelationship(members, "father", memberIdx) < MAX_FATHER;
  }
  return true;
}

export function getRelationshipOptionsForMember(
  members: Pick<FamilyMember, "relationship">[],
  memberIdx: number,
  gender?: EmployeeGender | ""
) {
  const current = members[memberIdx]?.relationship;
  return FAMILY_RELATIONSHIP_OPTIONS.filter(
    (opt) =>
      opt.value === current ||
      canSetFamilyRelationship(members, memberIdx, opt.value, gender)
  );
}

export function defaultRelationshipForNewMember(
  members: Pick<FamilyMember, "relationship">[],
  gender?: EmployeeGender | ""
): FamilyRelationship {
  const nextIdx = members.length;
  if (canSetFamilyRelationship(members, nextIdx, "spouse", gender)) return "spouse";
  if (canSetFamilyRelationship(members, nextIdx, "father", gender)) return "father";
  if (canSetFamilyRelationship(members, nextIdx, "mother", gender)) return "mother";
  return "son";
}

/** Convert legacy `parents` entries to father/mother when loading saved data. */
export function normalizeFamilyMembers(
  members: Array<FamilyMember & { relationship?: string }>
): FamilyMember[] {
  let fatherAssigned = false;
  let motherAssigned = false;

  return members.map((member) => {
    if (member.relationship === "father") {
      fatherAssigned = true;
      return member as FamilyMember;
    }
    if (member.relationship === "mother") {
      motherAssigned = true;
      return member as FamilyMember;
    }
    if (member.relationship === "parents") {
      if (!fatherAssigned) {
        fatherAssigned = true;
        return { ...member, relationship: "father" };
      }
      if (!motherAssigned) {
        motherAssigned = true;
        return { ...member, relationship: "mother" };
      }
    }
    return member as FamilyMember;
  });
}

export function trimSpousesForGender(
  members: FamilyMember[],
  gender?: EmployeeGender | ""
): FamilyMember[] {
  const max = maxSpousesForGender(gender);
  let spouseCount = 0;
  return members.filter((m) => {
    if (m.relationship !== "spouse") return true;
    spouseCount += 1;
    return spouseCount <= max;
  });
}

export function familyLimitsHint(gender?: EmployeeGender | ""): string {
  const spouseLimit = maxSpousesForGender(gender);
  const parts: string[] = [];
  if (spouseLimit > 0) {
    parts.push(
      gender === "male"
        ? `Up to ${spouseLimit} spouses`
        : `Up to ${spouseLimit} spouse`
    );
  } else if (gender) {
    parts.push("Spouse entries not applicable for this gender");
  }
  parts.push("1 father", "1 mother");
  return parts.join(" · ");
}

export interface FamilyValidationError {
  path: string;
  message: string;
}

export function validateFamilyMembers(
  members: FamilyMember[],
  gender?: EmployeeGender | ""
): FamilyValidationError[] {
  const errors: FamilyValidationError[] = [];
  const spouseCount = countFamilyRelationship(members, "spouse");
  const motherCount = countFamilyRelationship(members, "mother");
  const fatherCount = countFamilyRelationship(members, "father");
  const maxSpouses = maxSpousesForGender(gender);

  if (spouseCount > maxSpouses) {
    errors.push({
      path: "familyMembers",
      message:
        gender === "male"
          ? `Male employees can have at most ${maxSpouses} spouses (${spouseCount} entered)`
          : gender === "female"
            ? `Female employees can have at most ${maxSpouses} spouse (${spouseCount} entered)`
            : `Spouse entries are not allowed for this gender (${spouseCount} entered)`,
    });
  }

  if (motherCount > MAX_MOTHER) {
    errors.push({
      path: "familyMembers",
      message: `Only 1 mother allowed (${motherCount} entered)`,
    });
  }

  if (fatherCount > MAX_FATHER) {
    errors.push({
      path: "familyMembers",
      message: `Only 1 father allowed (${fatherCount} entered)`,
    });
  }

  members.forEach((member, idx) => {
    if (!member.name.trim()) {
      errors.push({
        path: `familyMembers.${idx}.name`,
        message: "Name is required",
      });
    }
  });

  return errors;
}

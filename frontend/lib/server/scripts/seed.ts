import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Company } from "../models/Company.model";
import { Branch } from "../models/Branch.model";
import { User } from "../models/User.model";
import { Employee } from "../models/Employee.model";
import { Attendance } from "../models/Attendance.model";
import { Leave } from "../models/Leave.model";
import { LeaveBalance } from "../models/LeaveBalance.model";
import { Notification } from "../models/Notification.model";
import { Recruitment } from "../models/Recruitment.model";
import { logger } from "../utils/logger";
const PASSWORD = "Password123!";

async function seed() {
  await connectDatabase();

  await Promise.all([
    Company.deleteMany({}),
    Branch.deleteMany({}),
    User.deleteMany({}),
    Employee.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    LeaveBalance.deleteMany({}),
    Notification.deleteMany({}),
    Recruitment.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const superAdmin = await User.create({
    email: "admin@noor.om",
    password: passwordHash,
    firstName: "Super",
    lastName: "Admin",
    role: "super_admin",
    isActive: true,
  });

  const companies = await Company.insertMany([
    {
      name: "NOOR Trading LLC",
      code: "NOOR01",
      email: "info@noor-trading.om",
      phone: "+968 2412 3456",
      address: "Al Khuwair, Muscat",
      createdBy: superAdmin._id,
    },
    {
      name: "Gulf Services Co.",
      code: "GULF01",
      email: "contact@gulfservices.om",
      phone: "+968 2412 7890",
      address: "Ruwi, Muscat",
      createdBy: superAdmin._id,
    },
  ]);

  const branchData: { companyIdx: number; name: string; code: string; city: string; lat: number; lng: number }[] = [];
  for (let c = 0; c < companies.length; c++) {
    const cities = [
      { name: "Muscat HQ", code: "MCT", city: "Muscat", lat: 23.588, lng: 58.3829 },
      { name: "Salalah Branch", code: "SLL", city: "Salalah", lat: 17.0151, lng: 54.0924 },
      { name: "Sohar Branch", code: "SHR", city: "Sohar", lat: 24.342, lng: 56.7299 },
    ];
    cities.forEach((city, i) => {
      branchData.push({
        companyIdx: c,
        name: `${companies[c].name.split(" ")[0]} ${city.name}`,
        code: `${companies[c].code}-${city.code}`,
        city: city.city,
        lat: city.lat,
        lng: city.lng,
      });
    });
  }

  const branches = await Branch.insertMany(
    branchData.map((b) => ({
      companyId: companies[b.companyIdx]._id,
      name: b.name,
      code: b.code,
      address: b.city,
      gpsCoordinates: { lat: b.lat, lng: b.lng },
      allowedRadius: 150,
      createdBy: superAdmin._id,
    }))
  );

  const owners = await User.insertMany(
    companies.map((co, i) => ({
      email: `owner${i + 1}@noor.om`,
      password: passwordHash,
      firstName: "Business",
      lastName: `Owner ${i + 1}`,
      role: "business_owner" as const,
      companyId: co._id,
      branchId: branches[i * 3]._id,
      isActive: true,
    }))
  );

  let empCounter = 0;
  const employees = [];

  for (const branch of branches) {
    const company = companies.find((c) => String(c._id) === String(branch.companyId))!;

    for (let i = 1; i <= 5; i++) {
      empCounter++;
      const employee = await Employee.create({
        employeeId: `EMP-${String(empCounter).padStart(4, "0")}`,
        companyId: company._id,
        branchId: branch._id,
        firstName: `Employee${empCounter}`,
        lastName: branch.code.split("-").pop() ?? "Staff",
        email: `emp${empCounter}@${company.code.toLowerCase()}.om`,
        phone: `+968 9${String(empCounter).padStart(7, "0")}`,
        department: i % 2 === 0 ? "Operations" : "HR",
        designation: i % 3 === 0 ? "Officer" : "Executive",
        employmentType: "full_time",
        joiningDate: new Date(2023, i % 12, 1),
        status: "active",
        createdBy: superAdmin._id,
      });
      employees.push(employee);

      await LeaveBalance.create({
        employeeId: employee._id,
        companyId: company._id,
        year: new Date().getFullYear(),
        annual: { total: 30, used: i, remaining: 30 - i },
        sick: { total: 14, used: 0, remaining: 14 },
        emergency: { total: 5, used: 0, remaining: 5 },
        unpaid: { total: 0, used: 0, remaining: 0 },
      });
    }
  }

  // Attendance — last 7 days for first 10 employees
  for (const employee of employees.slice(0, 10)) {
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const timeIn = new Date(date);
      timeIn.setHours(8, d % 2 === 0 ? 0 : 20, 0, 0);
      const timeOut = new Date(date);
      timeOut.setHours(17, 0, 0, 0);

      await Attendance.create({
        employeeId: employee._id,
        companyId: employee.companyId,
        branchId: employee.branchId,
        date,
        timeIn,
        timeOut,
        totalHours: 8.5,
        isLate: d % 2 !== 0,
        lateMinutes: d % 2 !== 0 ? 20 : 0,
        isEarlyLeave: false,
        earlyLeaveMinutes: 0,
        isMissedCheckout: d === 3,
        status: d === 3 ? "correction_pending" : d % 2 !== 0 ? "late" : "present",
        createdBy: superAdmin._id,
        updatedBy: superAdmin._id,
      });
    }
  }

  // Leave requests — pending, approved, and rejected samples
  const leaveSamples = [
    { offset: 7, days: 3, type: "annual" as const, status: "pending" as const, reason: "Family visit" },
    { offset: 14, days: 2, type: "sick" as const, status: "approved" as const, reason: "Medical appointment" },
    { offset: 21, days: 1, type: "emergency" as const, status: "rejected" as const, reason: "Personal errand" },
    { offset: 10, days: 5, type: "annual" as const, status: "pending" as const, reason: "Annual vacation" },
    { offset: -5, days: 2, type: "sick" as const, status: "approved" as const, reason: "Flu recovery" },
  ];

  for (let i = 0; i < employees.slice(0, 5).length; i++) {
    const employee = employees[i];
    const sample = leaveSamples[i];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + sample.offset);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + sample.days - 1);

    await Leave.create({
      employeeId: employee._id,
      companyId: employee.companyId,
      branchId: employee.branchId,
      type: sample.type,
      startDate,
      endDate,
      totalDays: sample.days,
      reason: sample.reason,
      status: sample.status,
      approvedBy: sample.status !== "pending" ? superAdmin._id : undefined,
      approvedAt: sample.status !== "pending" ? new Date() : undefined,
      rejectionReason: sample.status === "rejected" ? "Insufficient leave balance" : undefined,
      createdBy: superAdmin._id,
      updatedBy: superAdmin._id,
    });
  }

  // Notifications
  for (const owner of owners) {
    await Notification.insertMany([
      {
        userId: owner._id,
        companyId: owner.companyId,
        type: "leave_request",
        title: "New leave request",
        message: "An employee submitted a leave request for approval",
        isRead: false,
      },
      {
        userId: owner._id,
        companyId: owner.companyId,
        type: "document_expiry",
        title: "Document expiring",
        message: "A passport is expiring within 7 days",
        isRead: false,
      },
    ]);
  }

  // Recruitment samples
  await Recruitment.insertMany(
    branches.slice(0, 3).map((branch, i) => ({
      companyId: branch.companyId,
      branchId: branch._id,
      position: ["Sales Executive", "HR Officer", "Accountant"][i],
      department: "Operations",
      candidateName: `Candidate ${i + 1}`,
      candidateEmail: `candidate${i + 1}@email.com`,
      status: ["new", "shortlisted", "interview_scheduled"][i],
      createdBy: superAdmin._id,
    }))
  );

  logger.info("Seed completed successfully");
  console.log("\n--- NOOR ERP Seed Credentials ---");
  console.log(`Super Admin: admin@noor.om / ${PASSWORD}`);
  console.log(`Owner 1:     owner1@noor.om / ${PASSWORD}`);
  console.log(`Owner 2:     owner2@noor.om / ${PASSWORD}`);
  console.log(`Companies:   ${companies.length}`);
  console.log(`Branches:    ${branches.length}`);
  console.log(`Employees:   ${employees.length}`);
  console.log(`Attendance:  ${10 * 7} records (10 employees × 7 days)`);
  console.log(`Leaves:      5 requests (pending / approved / rejected)`);
  console.log("--------------------------------\n");

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

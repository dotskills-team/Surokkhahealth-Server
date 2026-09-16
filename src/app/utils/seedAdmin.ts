import bcrypt from "bcryptjs";
import { User } from "../modules/user/user.model";
import { Role } from "../modules/user/user.interface";
import { envVars } from "../config/env";

export const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({
      role: Role.SUPER_ADMIN,
    });

    if (adminExists) {
      console.log("✅ Super Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      envVars.SUPER_ADMIN_PASS,
       Number(envVars.BCRYPT_SALT_ROUND)
    );

    const admin = await User.create({
      name: "Super Admin",
      phone: envVars.SUPER_ADMIN_PHONE,
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isVerified: true,
    });

    console.log(
      `🔥 Default Super Admin created: ${admin.phone}`,
    );
  } catch (error) {
    console.error(
      "❌ Failed to seed Super Admin:",
      error,
    );
  }
};
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, CATEGORIES } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'citizen' },
    // Only for authority users: the category of issues they handle
    department: { type: String, enum: [...CATEGORIES, null], default: null },
    area: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, role, department, area, active, createdAt } = this;
  return { _id, name, email, role, department, area, active, createdAt };
};

export default mongoose.model('User', userSchema);

import mongoose from 'mongoose';
import { CATEGORIES, STATUSES, PRIORITIES } from '../utils/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, trim: true, default: '' },
    by: { type: ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: STATUSES, default: 'reported' },
    location: {
      address: { type: String, required: true, trim: true },
      area: { type: String, trim: true, default: '' },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    image: { type: String, default: '' }, // compressed data URL
    reporter: { type: ObjectId, ref: 'User', required: true },
    assignedTo: { type: ObjectId, ref: 'User', default: null },
    upvotes: [{ type: ObjectId, ref: 'User' }],
    comments: [commentSchema],
    history: [historySchema],
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

issueSchema.index({ title: 'text', description: 'text', 'location.address': 'text', 'location.area': 'text' });
issueSchema.index({ category: 1, status: 1, createdAt: -1 });

export default mongoose.model('Issue', issueSchema);

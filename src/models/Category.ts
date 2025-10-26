// backend/src/models/Category.ts
console.log("=== CATEGORY.MODEL: Loading module ===");
import  { Document, Schema } from 'mongoose';
console.log("=== CATEGORY.MODEL: mongoose types imported ===");
import { mongoose } from "../lib/mongoose";
console.log("=== CATEGORY.MODEL: mongoose instance imported ===");

export interface ICategory extends Document {
  key: string;
  label: string;
  icon: string;
  color: string;
  parent?: mongoose.Types.ObjectId;
  order: number;
  active?: boolean;
  language?: string;
  isDynamic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const categorySchema = new Schema<ICategory>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
      default: 'newspaper',
    },
    color: {
      type: String,
      required: true,
      default: '#6366f1',
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    language: {
      type: String,
      trim: true,
      lowercase: true,
    },
    isDynamic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

// Indexes
console.log("=== CATEGORY.MODEL: About to create indexes ===");
categorySchema.index({ parent: 1 });
categorySchema.index({ order: 1 });
console.log("=== CATEGORY.MODEL: Indexes created ===");

console.log("=== CATEGORY.MODEL: About to create model ===");
export const Category = mongoose.model<ICategory>('Category', categorySchema);
console.log("=== CATEGORY.MODEL: Model created and exported ===");
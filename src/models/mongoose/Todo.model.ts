import mongoose, { Document, Schema } from 'mongoose';

/**
 * Todo interface for TypeScript
 */
export interface ITodo extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Todo Mongoose Schema
 */
const TodoSchema = new Schema<ITodo>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'todos',
  }
);

// Add indexes for performance
TodoSchema.index({ completed: 1 });
TodoSchema.index({ createdAt: -1 });

/**
 * Todo Model
 */
export const TodoModel = mongoose.model<ITodo>('Todo', TodoSchema);

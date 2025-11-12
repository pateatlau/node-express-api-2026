import { TodoModel, ITodo } from '../models/mongoose/Todo.model';
import {
  ITodoRepository,
  TodoDTO,
  CreateTodoDTO,
  UpdateTodoDTO,
  PaginationParams,
} from './TodoRepository.interface';

/**
 * Mongoose implementation of Todo Repository
 */
export class MongooseTodoRepository implements ITodoRepository {
  /**
   * Convert Mongoose document to DTO
   */
  private toDTO(todo: ITodo): TodoDTO {
    return {
      id: todo._id.toString(),
      title: todo.title,
      completed: todo.completed,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async findAll(params: PaginationParams): Promise<TodoDTO[]> {
    const todos = await TodoModel.find()
      .sort({ createdAt: -1 })
      .skip(params.skip)
      .limit(params.take)
      .lean()
      .exec();

    return todos.map((todo) => this.toDTO(todo as unknown as ITodo));
  }

  async findById(id: string): Promise<TodoDTO | null> {
    const todo = await TodoModel.findById(id).lean().exec();

    if (!todo) {
      return null;
    }

    return this.toDTO(todo as unknown as ITodo);
  }

  async create(data: CreateTodoDTO): Promise<TodoDTO> {
    const todo = await TodoModel.create({
      title: data.title,
      completed: data.completed ?? false,
    });

    return this.toDTO(todo);
  }

  async update(id: string, data: UpdateTodoDTO): Promise<TodoDTO | null> {
    const todo = await TodoModel.findByIdAndUpdate(
      id,
      {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.completed !== undefined && { completed: data.completed }),
      },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      }
    )
      .lean()
      .exec();

    if (!todo) {
      return null;
    }

    return this.toDTO(todo as unknown as ITodo);
  }

  async delete(id: string): Promise<boolean> {
    const result = await TodoModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(): Promise<number> {
    return await TodoModel.countDocuments().exec();
  }
}

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
      userId: todo.userId,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  }

  async findAll(params: PaginationParams): Promise<TodoDTO[]> {
    const filter = params.userId ? { userId: params.userId } : {};

    const todos = await TodoModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(params.skip)
      .limit(params.take)
      .lean()
      .exec();

    return todos.map((todo) => this.toDTO(todo as unknown as ITodo));
  }

  async findById(id: string, userId?: string): Promise<TodoDTO | null> {
    const filter: { _id: string; userId?: string } = { _id: id };
    if (userId) {
      filter.userId = userId;
    }

    const todo = await TodoModel.findOne(filter).lean().exec();

    if (!todo) {
      return null;
    }

    return this.toDTO(todo as unknown as ITodo);
  }

  async create(data: CreateTodoDTO): Promise<TodoDTO> {
    const todo = await TodoModel.create({
      title: data.title,
      completed: data.completed ?? false,
      userId: data.userId,
    });

    return this.toDTO(todo);
  }

  async update(id: string, data: UpdateTodoDTO, userId?: string): Promise<TodoDTO | null> {
    const filter: { _id: string; userId?: string } = { _id: id };
    if (userId) {
      filter.userId = userId;
    }

    const todo = await TodoModel.findOneAndUpdate(
      filter,
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

  async delete(id: string, userId?: string): Promise<boolean> {
    const filter: { _id: string; userId?: string } = { _id: id };
    if (userId) {
      filter.userId = userId;
    }

    const result = await TodoModel.findOneAndDelete(filter).exec();
    return result !== null;
  }

  async count(userId?: string): Promise<number> {
    const filter = userId ? { userId } : {};
    return await TodoModel.countDocuments(filter).exec();
  }
}

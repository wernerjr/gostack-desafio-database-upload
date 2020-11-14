import { getRepository } from 'typeorm';

import Category from '../models/Category';

interface Request {
  title: string;
}

class CreateCategoryService {
  public async execute({ title }: Request): Promise<Category> {
    const categoryRepository = getRepository(Category);

    const categoryExists = await categoryRepository.findOne({
      where: {
        title,
      },
    });

    if (categoryExists) {
      return categoryExists;
    }

    const category = categoryRepository.create({
      title,
    });
    await categoryRepository.save(category);

    return category;
  }
}

export default CreateCategoryService;

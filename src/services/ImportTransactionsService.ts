import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import { getCustomRepository, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import uploadConfig from '../config/upload';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';

interface Request {
  transactionsFileName: string;
}

interface NewCategory {
  title: string;
}

interface NewTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category_id: string;
}

interface TransactionCsv {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
  category_id: string;
}

class ImportTransactionsService {
  async execute({ transactionsFileName }: Request): Promise<Transaction[]> {
    const fileName = path.join(uploadConfig.directory, transactionsFileName);
    const csvTransactions = await this.loadCSV(fileName);
    const categories = await this.addNewCategories(csvTransactions);
    const transactions = await this.addNewTransactions(
      csvTransactions,
      categories,
    );

    return transactions;
  }

  private async addNewTransactions(
    csvTransactions: TransactionCsv[],
    categories: Category[],
  ): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const transactionsList = [] as NewTransaction[];

    const balance = await transactionsRepository.getBalance();
    const newTransactionsBalance = csvTransactions.reduce(
      (total, transaction) => this.getFileBalance(total, transaction),
      0,
    );

    if (
      newTransactionsBalance < 0 &&
      balance.total + newTransactionsBalance < 0
    )
      throw new AppError('You dont have this sum of value to outcome.', 400);

    csvTransactions.forEach(transaction => {
      const category_id = categories.find(
        category => category.title === transaction.category,
      )?.id;
      if (category_id !== undefined)
        transactionsList.push({
          title: transaction.title,
          type: transaction.type,
          value: transaction.value,
          category_id,
        });
    });

    const transactions = transactionsRepository.create(transactionsList);
    return transactionsRepository.save(transactions);
  }

  private getFileBalance(total: number, transaction: NewTransaction): number {
    return transaction.type === 'income'
      ? total + transaction.value
      : total - transaction.value;
  }

  private async addNewCategories(
    csvTransactions: TransactionCsv[],
  ): Promise<Category[]> {
    const categoryRepository = getRepository(Category);
    const categoriesList = csvTransactions.reduce(
      (categories, newCategory) =>
        this.getUniqueCategory(categories, newCategory.category),
      [] as NewCategory[],
    );

    const existingCategories = await categoryRepository.find();

    const categories = categoryRepository.create(
      categoriesList.filter(
        category =>
          !existingCategories.find(
            existingCategory => existingCategory.title === category.title,
          ),
      ),
    );

    const newCategories = await categoryRepository.save(categories);

    return existingCategories.concat(newCategories);
  }

  private getUniqueCategory(
    categories: NewCategory[],
    newCategory: string,
  ): NewCategory[] {
    const existsCategory = categories.find(
      category => category.title === newCategory,
    );
    if (!existsCategory) categories.push({ title: newCategory });

    return categories;
  }

  private async loadCSV(filePath: string): Promise<TransactionCsv[]> {
    const readCSVStream = fs.createReadStream(filePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const lines = [] as TransactionCsv[];

    parseCSV.on('data', line => {
      const [title, type, value, category] = line;
      if (type === 'income' || type === 'outcome')
        lines.push({
          title,
          type,
          value: Number(value),
          category,
          category_id: '',
        });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    return lines;
  }
}

export default ImportTransactionsService;

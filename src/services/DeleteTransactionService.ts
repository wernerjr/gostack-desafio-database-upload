import { getCustomRepository } from 'typeorm';

import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';

interface Request {
  id: string;
}
class DeleteTransactionService {
  public async execute({ id }: Request): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionRepository);

    const existsTransaction = await transactionRepository.findOne(id);

    if (!existsTransaction) {
      throw new AppError('Transaction does not exists', 400);
    }

    await transactionRepository.delete(id);
  }
}

export default DeleteTransactionService;

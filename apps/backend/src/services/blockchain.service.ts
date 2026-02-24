import { ethers } from 'ethers';
import { logger } from '../config/logger';

export interface TransactionRequest {
  to: string;
  from: string;
  data: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  gasUsed: string;
  status: number;
  logs: readonly any[];
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string | undefined;
  maxPriorityFeePerGas?: string | undefined;
  estimatedCost: string;
}

export interface ContractCall {
  contractAddress: string;
  methodName: string;
  params: any[];
  abi: any[];
}

export interface WalletBalance {
  address: string;
  balance: string;
  balanceInEth: string;
}

/**
 * Blockchain Service
 * Handles smart contract interactions, transaction signing, and blockchain operations
 * 
 * Requirements: 3.2, 8.2
 * - Process transactions through connected wallets
 * - Record transactions immutably on blockchain
 * - Estimate gas for transactions
 * - Monitor transaction status
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private readonly NETWORK_NAME: string;
  private readonly CHAIN_ID: number;
  private readonly GAS_BUFFER_MULTIPLIER = 1.2; // 20% buffer for gas estimation
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor(rpcUrl?: string, networkName: string = 'polygon', chainId: number = 137) {
    const url = rpcUrl || process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com';
    this.provider = new ethers.JsonRpcProvider(url);
    this.NETWORK_NAME = networkName;
    this.CHAIN_ID = chainId;

    logger.info('Blockchain service initialized', {
      network: this.NETWORK_NAME,
      chainId: this.CHAIN_ID,
      rpcUrl: url
    });
  }

  /**
   * Estimate gas for a transaction
   * Requirement 3.2
   */
  async estimateGas(transaction: TransactionRequest): Promise<GasEstimate> {
    try {
      // Estimate gas limit
      const gasLimit = await this.provider.estimateGas({
        to: transaction.to,
        from: transaction.from,
        data: transaction.data,
        value: transaction.value ? BigInt(transaction.value) : null
      });

      // Add buffer to gas limit
      const bufferedGasLimit = (gasLimit * BigInt(Math.floor(this.GAS_BUFFER_MULTIPLIER * 100))) / BigInt(100);

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      
      let gasPrice = feeData.gasPrice || BigInt(0);
      let maxFeePerGas = feeData.maxFeePerGas;
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Calculate estimated cost
      const estimatedCost = bufferedGasLimit * gasPrice;

      logger.info('Gas estimated', {
        gasLimit: bufferedGasLimit.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCost: estimatedCost.toString(),
        to: transaction.to
      });

      return {
        gasLimit: bufferedGasLimit.toString(),
        gasPrice: gasPrice.toString(),
        maxFeePerGas: maxFeePerGas?.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
        estimatedCost: estimatedCost.toString()
      };

    } catch (error) {
      logger.error('Failed to estimate gas', {
        transaction,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign and broadcast a transaction
   * Requirement 3.2, 8.2
   */
  async signAndBroadcastTransaction(
    transaction: TransactionRequest,
    privateKey: string
  ): Promise<TransactionReceipt> {
    try {
      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, this.provider);

      // Estimate gas if not provided
      let gasLimit = transaction.gasLimit;
      let gasPrice = transaction.gasPrice;

      if (!gasLimit || !gasPrice) {
        const estimate = await this.estimateGas(transaction);
        gasLimit = gasLimit || estimate.gasLimit;
        gasPrice = gasPrice || estimate.gasPrice;
      }

      // Prepare transaction
      const tx = {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value ? BigInt(transaction.value) : null,
        gasLimit: BigInt(gasLimit),
        gasPrice: BigInt(gasPrice)
      };

      // Sign and send transaction
      const txResponse = await wallet.sendTransaction(tx);

      logger.info('Transaction broadcasted', {
        hash: txResponse.hash,
        from: wallet.address,
        to: transaction.to,
        nonce: txResponse.nonce
      });

      // Wait for confirmation
      const receipt = await txResponse.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      logger.info('Transaction confirmed', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to || '',
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status || 0,
        logs: receipt.logs
      };

    } catch (error) {
      logger.error('Failed to sign and broadcast transaction', {
        transaction,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Monitor transaction status
   * Requirement 3.2
   */
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
    receipt?: TransactionReceipt;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          status: 'pending',
          confirmations: 0
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations,
        receipt: {
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          from: receipt.from,
          to: receipt.to || '',
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status || 0,
          logs: receipt.logs
        }
      };

    } catch (error) {
      logger.error('Failed to get transaction status', {
        txHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Call a smart contract method (read-only)
   */
  async callContract(call: ContractCall): Promise<any> {
    try {
      const contract = new ethers.Contract(
        call.contractAddress,
        call.abi,
        this.provider
      );

      const result = await contract[call.methodName](...call.params);

      logger.info('Contract method called', {
        contract: call.contractAddress,
        method: call.methodName,
        params: call.params
      });

      return result;

    } catch (error) {
      logger.error('Failed to call contract', {
        call,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Encode contract method call data
   */
  encodeContractCall(call: ContractCall): string {
    try {
      const iface = new ethers.Interface(call.abi);
      const data = iface.encodeFunctionData(call.methodName, call.params);

      logger.info('Contract call encoded', {
        contract: call.contractAddress,
        method: call.methodName,
        data
      });

      return data;

    } catch (error) {
      logger.error('Failed to encode contract call', {
        call,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Decode contract event logs
   */
  decodeEventLogs(logs: any[], abi: any[], eventName: string): any[] {
    try {
      const iface = new ethers.Interface(abi);
      const decodedLogs: any[] = [];

      for (const log of logs) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });

          if (parsed && parsed.name === eventName) {
            decodedLogs.push({
              name: parsed.name,
              args: parsed.args,
              signature: parsed.signature
            });
          }
        } catch (e) {
          // Skip logs that don't match the ABI
          continue;
        }
      }

      return decodedLogs;

    } catch (error) {
      logger.error('Failed to decode event logs', {
        eventName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const balance = await this.provider.getBalance(address);
      const balanceInEth = ethers.formatEther(balance);

      logger.info('Balance retrieved', {
        address,
        balance: balance.toString(),
        balanceInEth
      });

      return {
        address,
        balance: balance.toString(),
        balanceInEth
      };

    } catch (error) {
      logger.error('Failed to get balance', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation with retries
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
    timeout: number = 120000 // 2 minutes
  ): Promise<TransactionReceipt> {
    try {
      const startTime = Date.now();
      let attempts = 0;

      while (attempts < this.MAX_RETRIES) {
        try {
          const receipt = await this.provider.waitForTransaction(txHash, confirmations, timeout);

          if (!receipt) {
            throw new Error('Transaction receipt not available');
          }

          logger.info('Transaction confirmed after waiting', {
            hash: txHash,
            confirmations,
            attempts: attempts + 1,
            timeElapsed: Date.now() - startTime
          });

          return {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
            from: receipt.from,
            to: receipt.to || '',
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status || 0,
            logs: receipt.logs
          };

        } catch (error) {
          attempts++;
          
          if (attempts >= this.MAX_RETRIES) {
            throw error;
          }

          logger.warn('Retrying transaction wait', {
            txHash,
            attempt: attempts,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }

      throw new Error('Max retries exceeded waiting for transaction');

    } catch (error) {
      logger.error('Failed to wait for transaction', {
        txHash,
        confirmations,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verify transaction immutability
   * Requirement 8.2
   */
  async verifyTransactionImmutability(txHash: string): Promise<{
    isImmutable: boolean;
    confirmations: number;
    blockNumber: number;
    timestamp: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          isImmutable: false,
          confirmations: 0,
          blockNumber: 0,
          timestamp: 0
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      // Get block timestamp
      const block = await this.provider.getBlock(receipt.blockNumber);
      const timestamp = block?.timestamp || 0;

      // Consider transaction immutable after 12 confirmations (Polygon standard)
      const isImmutable = confirmations >= 12;

      logger.info('Transaction immutability verified', {
        txHash,
        isImmutable,
        confirmations,
        blockNumber: receipt.blockNumber,
        timestamp
      });

      return {
        isImmutable,
        confirmations,
        blockNumber: receipt.blockNumber,
        timestamp
      };

    } catch (error) {
      logger.error('Failed to verify transaction immutability', {
        txHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{
    name: string;
    chainId: number;
    blockNumber: number;
    gasPrice: string;
  }> {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const feeData = await this.provider.getFeeData();

      return {
        name: this.NETWORK_NAME,
        chainId: Number(network.chainId),
        blockNumber,
        gasPrice: feeData.gasPrice?.toString() || '0'
      };

    } catch (error) {
      logger.error('Failed to get network info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Format wei to ether
   */
  formatEther(wei: string): string {
    return ethers.formatEther(wei);
  }

  /**
   * Parse ether to wei
   */
  parseEther(ether: string): string {
    return ethers.parseEther(ether).toString();
  }
}

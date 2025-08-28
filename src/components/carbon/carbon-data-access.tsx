'use client'

import { getCarbonProgram, getCarbonProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import BN from 'bn.js'
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'

type ProjectType = 
  | { reforestation: {} }
  | { renewableEnergy: {} }
  | { energyEfficiency: {} }
  | { wasteManagement: {} }
  | { carbonCapture: {} }
  | { other: {} }

interface InitializeProgramHandlerArgs {
  authorityPubkey: PublicKey
}

interface CreateProjectHandlerArgs {
  projectOwnerPubkey: PublicKey
  projectId: BN
  projectName: string
  projectDescription: string
  projectLocation: string
  projectType: ProjectType
  verificationStandard: string
  estimatedCredits: BN
}

interface VerifyProjectHandlerArgs {
  authorityPubkey: PublicKey
  projectId: BN
}

interface IssueCreditsHandlerArgs {
  authorityPubkey: PublicKey
  projectId: BN
  amount: BN
  vintageYear: number
  metadataUri: string
  recipientPubkey: PublicKey
  mint: PublicKey
  mintAuthorityPubkey: PublicKey
}

interface RetireCreditsHandlerArgs {
  userPubkey: PublicKey
  batchId: BN
  amount: BN
  reason: string
  mint: PublicKey
}

interface TransferCreditsHandlerArgs {
  fromAuthorityPubkey: PublicKey
  toPubkey: PublicKey
  amount: BN
  mint: PublicKey
}

export function useCarbonProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getCarbonProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getCarbonProgram(provider, programId), [provider, programId])

  const creditBatchAccounts = useQuery({
    queryKey: ['creditBatch', 'all', { cluster }],
    queryFn: () => program.account.creditBatch.all(),
  })

  const programStateAccounts = useQuery({
    queryKey: ['programState', 'all', { cluster }],
    queryFn: () => program.account.programState.all(),
  })

  const projectAccounts = useQuery({
    queryKey: ['project', 'all', { cluster }],
    queryFn: () => program.account.project.all(),
  })

  const retirementAccounts = useQuery({
    queryKey: ['retirement', 'all', { cluster }],
    queryFn: () => program.account.retirement.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initializeProgramHandler = useMutation<string, Error, InitializeProgramHandlerArgs>({
    mutationKey: ['initializeProgram', 'initialize', { cluster }],
    mutationFn: async ({ authorityPubkey }) => {
      const [programState] = PublicKey.findProgramAddressSync(
        [Buffer.from("program_state")],
        program.programId
      )
      
      return await program.methods
        .initializeProgram()
        .accountsStrict({
          programState,
          authority: authorityPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await programStateAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to initialize program')
    },
  })

  const createProjectHandler = useMutation<string, Error, CreateProjectHandlerArgs>({
    mutationKey: ['createProject', 'create', { cluster }],
    mutationFn: async ({ 
      projectOwnerPubkey, 
      projectId, 
      projectName, 
      projectDescription, 
      projectLocation, 
      projectType, 
      verificationStandard, 
      estimatedCredits 
    }) => {
      const [programState] = PublicKey.findProgramAddressSync(
        [Buffer.from("program_state")],
        program.programId
      )

      const [project] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      return await program.methods
        .createProject(
          projectId,
          projectName,
          projectDescription,
          projectLocation,
          projectType,
          verificationStandard,
          estimatedCredits
        )
        .accountsStrict({
          project,
          programState,
          projectOwner: projectOwnerPubkey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await Promise.all([
        programStateAccounts.refetch(),
        projectAccounts.refetch()
      ])
    },
    onError: () => {
      toast.error('Failed to create project')
    },
  })

  const verifyProjectHandler = useMutation<string, Error, VerifyProjectHandlerArgs>({
    mutationKey: ['verifyProject', 'verify', { cluster }],
    mutationFn: async ({ authorityPubkey, projectId }) => {
      const [programState] = PublicKey.findProgramAddressSync(
        [Buffer.from("program_state")],
        program.programId
      )

      const [project] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      return await program.methods
        .verifyProject()
        .accountsStrict({
          project,
          authority: authorityPubkey,
          programState,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await projectAccounts.refetch()
    },
    onError: () => {
      toast.error('Failed to verify project')
    },
  })

  const issueCreditsHandler = useMutation<string, Error, IssueCreditsHandlerArgs>({
    mutationKey: ['issueCredits', 'issue', { cluster }],
    mutationFn: async ({ 
      authorityPubkey, 
      projectId, 
      amount, 
      vintageYear, 
      metadataUri, 
      recipientPubkey, 
      mint, 
      mintAuthorityPubkey 
    }) => {
      const [programState] = PublicKey.findProgramAddressSync(
        [Buffer.from("program_state")],
        program.programId
      )

      const [project] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      // Get current program state to determine batch ID
      const currentState = await program.account.programState.fetch(programState)
      const [creditBatch] = PublicKey.findProgramAddressSync(
        [Buffer.from("credit_batch"), currentState.totalCreditsIssued.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mint,
        recipientPubkey
      )

      return await program.methods
        .issueCredits(amount, vintageYear, metadataUri)
        .accountsStrict({
          project,
          creditBatch,
          programState,
          mint,
          recipientTokenAccount,
          mintAuthority: mintAuthorityPubkey,
          recipient: recipientPubkey,
          authority: authorityPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await Promise.all([
        programStateAccounts.refetch(),
        projectAccounts.refetch(),
        creditBatchAccounts.refetch()
      ])
    },
    onError: () => {
      toast.error('Failed to issue credits')
    },
  })

  const retireCreditsHandler = useMutation<string, Error, RetireCreditsHandlerArgs>({
    mutationKey: ['retireCredits', 'retire', { cluster }],
    mutationFn: async ({ userPubkey, batchId, amount, reason, mint }) => {
      const [programState] = PublicKey.findProgramAddressSync(
        [Buffer.from("program_state")],
        program.programId
      )

      const [creditBatch] = PublicKey.findProgramAddressSync(
        [Buffer.from("credit_batch"), batchId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      // Get credit batch to find project ID
      const batchAccount = await program.account.creditBatch.fetch(creditBatch)
      const [project] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), batchAccount.projectId.toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      const [retirement] = PublicKey.findProgramAddressSync(
        [Buffer.from("retirement"), batchId.toArrayLike(Buffer, "le", 8), userPubkey.toBuffer()],
        program.programId
      )

      const userTokenAccount = getAssociatedTokenAddressSync(
        mint,
        userPubkey
      )

      return await program.methods
        .retireCredits(amount, reason)
        .accountsStrict({
          creditBatch,
          project,
          programState,
          retirement,
          mint,
          userTokenAccount,
          user: userPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await Promise.all([
        programStateAccounts.refetch(),
        projectAccounts.refetch(),
        creditBatchAccounts.refetch(),
        retirementAccounts.refetch()
      ])
    },
    onError: () => {
      toast.error('Failed to retire credits')
    },
  })

  const transferCreditsHandler = useMutation<string, Error, TransferCreditsHandlerArgs>({
    mutationKey: ['transferCredits', 'transfer', { cluster }],
    mutationFn: async ({ fromAuthorityPubkey, toPubkey, amount, mint }) => {
      const fromTokenAccount = getAssociatedTokenAddressSync(
        mint,
        fromAuthorityPubkey
      )

      const toTokenAccount = getAssociatedTokenAddressSync(
        mint,
        toPubkey
      )

      return await program.methods
        .transferCredits(amount)
        .accountsStrict({
          fromTokenAccount,
          toTokenAccount,
          fromAuthority: fromAuthorityPubkey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      // Note: Token transfers don't affect our program accounts, but you might want to refresh
      // any token balance queries you have
    },
    onError: () => {
      toast.error('Failed to transfer credits')
    },
  })

  return {
    program,
    programId,
    creditBatchAccounts,
    programStateAccounts,
    projectAccounts,
    retirementAccounts,
    getProgramAccount,
    initializeProgramHandler,
    createProjectHandler,
    verifyProjectHandler,
    issueCreditsHandler,
    retireCreditsHandler,
    transferCreditsHandler,
  }
}

export function useCarbonProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const { program } = useCarbonProgram()

  // Query for specific project account
  const projectQuery = useQuery({
    queryKey: ['project', 'fetch', { cluster, account }],
    queryFn: () => program.account.project.fetch(account),
  })

  // Query for specific credit batch account
  const creditBatchQuery = useQuery({
    queryKey: ['creditBatch', 'fetch', { cluster, account }],
    queryFn: () => program.account.creditBatch.fetch(account),
  })

  // Query for specific retirement account
  const retirementQuery = useQuery({
    queryKey: ['retirement', 'fetch', { cluster, account }],
    queryFn: () => program.account.retirement.fetch(account),
  })

  // Query for program state account
  const programStateQuery = useQuery({
    queryKey: ['programState', 'fetch', { cluster, account }],
    queryFn: () => program.account.programState.fetch(account),
  })

  return {
    projectQuery,
    creditBatchQuery,
    retirementQuery,
    programStateQuery,
  }
}

// Helper function to get PDA addresses
export function getCarbonProgramPDAs(programId: PublicKey) {
  const getProgramStatePDA = () => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      programId
    )
  }

  const getProjectPDA = (projectId: BN) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
      programId
    )
  }

  const getCreditBatchPDA = (batchId: BN) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("credit_batch"), batchId.toArrayLike(Buffer, "le", 8)],
      programId
    )
  }

  const getRetirementPDA = (batchId: BN, userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("retirement"), batchId.toArrayLike(Buffer, "le", 8), userPubkey.toBuffer()],
      programId
    )
  }

  return {
    getProgramStatePDA,
    getProjectPDA,
    getCreditBatchPDA,
    getRetirementPDA,
  }
}
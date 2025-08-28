import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { Carbon } from '../target/types/carbon'
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  createMint, 
  getOrCreateAssociatedTokenAccount 
} from "@solana/spl-token";

describe('Carbon Credit Depin', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const payer = provider.wallet as anchor.Wallet

  const program = anchor.workspace.Carbon as Program<Carbon>

  let programState: PublicKey;
  let authority: Keypair;
  let projectOwner: Keypair;
  let user: Keypair;
  let mint: PublicKey;
  let mintAuthority: Keypair;

  const projectId = new anchor.BN(1);
  const projectName = "Reforestation Project";
  const projectDescription = "Large scale reforestation in Amazon";
  const projectLocation = "Brazil";
  const verificationStandard = "VCS";
  const estimatedCredits = new anchor.BN(10000);

  beforeAll(async () => {
    authority = Keypair.generate();
    projectOwner = Keypair.generate();
    user = Keypair.generate();
    mintAuthority = Keypair.generate();

    // Airdrop SOL to accounts
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(projectOwner.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(mintAuthority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create mint
    mint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    // Derive PDA addresses
    [programState] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_state")],
      program.programId
    );
  });

  it("Initializes the program", async () => {
    await program.methods
      .initializeProgram()
      .accountsStrict({
        programState,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const programStateAccount = await program.account.programState.fetch(programState);
    expect(programStateAccount.authority.toString()).toEqual(authority.publicKey.toString());
    expect(programStateAccount.totalCreditsIssued.toNumber()).toEqual(0);
    expect(programStateAccount.totalCreditsRetired.toNumber()).toEqual(0);
    expect(programStateAccount.projectCount.toNumber()).toEqual(0);
  });

  it("Creates a project", async () => {
    const [project] = PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .createProject(
        projectId,
        projectName,
        projectDescription,
        projectLocation,
        { reforestation: {} },
        verificationStandard,
        estimatedCredits
      )
      .accountsStrict({
        project,
        programState,
        projectOwner: projectOwner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([projectOwner])
      .rpc();

    const projectAccount = await program.account.project.fetch(project);
    expect(projectAccount.name).toEqual(projectName);
    expect(projectAccount.description).toEqual(projectDescription);
    expect(projectAccount.location).toEqual(projectLocation);
    expect(projectAccount.estimatedCredits.toString()).toEqual(estimatedCredits.toString());
    expect(projectAccount.owner.toString()).toEqual(projectOwner.publicKey.toString());
    // expect(projectAccount.status).toContainEqual({ pending: {} }); // check

    const programStateAccount = await program.account.programState.fetch(programState);
    expect(programStateAccount.projectCount.toNumber()).toEqual(1);
  });

  it("Verifies a project", async () => {
    const [project] = PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .verifyProject()
      .accountsStrict({
        project,
        authority: authority.publicKey,
        programState,
      })
      .signers([authority])
      .rpc();

    const projectAccount = await program.account.project.fetch(project);
    // expect(projectAccount.status).toContainEqual({ verified: {} });
    expect(projectAccount.verifiedAt.toNumber()).toBeGreaterThan(0);
  });

  it("Issues credits", async () => {
    const [project] = PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const currentState = await program.account.programState.fetch(programState);
    const [creditBatch] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_batch"), currentState.totalCreditsIssued.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      mint,
      user.publicKey
    );

    const amount = new anchor.BN(1000);
    const vintageYear = 2023;
    const metadataUri = "https://example.com/metadata/batch1.json";

    await program.methods
      .issueCredits(amount, vintageYear, metadataUri)
      .accountsStrict({
        project,
        creditBatch,
        programState,
        mint,
        recipientTokenAccount: recipientTokenAccount.address,
        mintAuthority: mintAuthority.publicKey,
        recipient: user.publicKey,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority, mintAuthority])
      .rpc();

    const creditBatchAccount = await program.account.creditBatch.fetch(creditBatch);
    expect(creditBatchAccount.projectId.toString()).toEqual(projectId.toString());
    expect(creditBatchAccount.amount.toString()).toEqual(amount.toString());
    expect(creditBatchAccount.vintageYear).toEqual(vintageYear);
    expect(creditBatchAccount.metadataUri).toEqual(metadataUri);
    expect(creditBatchAccount.owner.toString()).toEqual(user.publicKey.toString());

    const projectAccount = await program.account.project.fetch(project);
    expect(projectAccount.issuedCredits.toString()).toEqual(amount.toString());

    const updatedState = await program.account.programState.fetch(programState);
    expect(updatedState.totalCreditsIssued.toString()).toEqual(amount.toString());

    // Check token balance
    const tokenBalance = await provider.connection.getTokenAccountBalance(recipientTokenAccount.address);
    expect(tokenBalance.value.amount).toEqual(amount.toString());
  });

  it("Retires credits", async () => {
    const [project] = PublicKey.findProgramAddressSync(
      [Buffer.from("project"), projectId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const batchId = new anchor.BN(0);
    const [creditBatch] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit_batch"), batchId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const [retirement] = PublicKey.findProgramAddressSync(
      [Buffer.from("retirement"), batchId.toArrayLike(Buffer, "le", 8), user.publicKey.toBuffer()],
      program.programId
    );

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    const retireAmount = new anchor.BN(500);
    const retireReason = "Offsetting flight emissions";

    await program.methods
      .retireCredits(retireAmount, retireReason)
      .accountsStrict({
        creditBatch,
        project,
        programState,
        retirement,
        mint,
        userTokenAccount: userTokenAccount.address,
        user: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const retirementAccount = await program.account.retirement.fetch(retirement);
    expect(retirementAccount.amount.toString()).toEqual(retireAmount.toString());
    expect(retirementAccount.reason).toEqual(retireReason);
    expect(retirementAccount.retiredBy.toString()).toEqual(user.publicKey.toString());

    const creditBatchAccount = await program.account.creditBatch.fetch(creditBatch);
    expect(creditBatchAccount.retiredAmount.toString()).toEqual(retireAmount.toString());

    const projectAccount = await program.account.project.fetch(project);
    expect(projectAccount.retiredCredits.toString()).toEqual(retireAmount.toString());

    const updatedState = await program.account.programState.fetch(programState);
    expect(updatedState.totalCreditsRetired.toString()).toEqual(retireAmount.toString());

    // Check token balance after retirement (burn)
    const tokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount.address);
    expect(tokenBalance.value.amount).toEqual("500"); // 1000 - 500 = 500
  });

  it("Transfers credits", async () => {
    const recipient = Keypair.generate();
    await provider.connection.requestAirdrop(recipient.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 500));

    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      recipient.publicKey
    );

    const transferAmount = new anchor.BN(200);

    await program.methods
      .transferCredits(transferAmount)
      .accountsStrict({
        fromTokenAccount: fromTokenAccount.address,
        toTokenAccount: toTokenAccount.address,
        fromAuthority: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Check balances after transfer
    const fromBalance = await provider.connection.getTokenAccountBalance(fromTokenAccount.address);
    const toBalance = await provider.connection.getTokenAccountBalance(toTokenAccount.address);
    
    expect(fromBalance.value.amount).toEqual("300"); // 500 - 200 = 300
    expect(toBalance.value.amount).toEqual("200");
  });
})

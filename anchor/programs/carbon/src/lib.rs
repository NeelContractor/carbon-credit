#![allow(clippy::result_large_err)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
    associated_token::AssociatedToken,
};

declare_id!("6XkQn6ub71Drxp74UE6LrrvNH6K6GnCbxXwCH6NrDLb");

#[program]
pub mod carbon {
    use super::*;

    pub fn initialize_program(ctx: Context<InitializeProgram>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.authority = ctx.accounts.authority.key();
        program_state.total_credits_issued = 0;
        program_state.total_credits_retired = 0;
        program_state.project_count = 0;
        program_state.bump = ctx.bumps.program_state;
        Ok(())
    }

    pub fn create_project(
        ctx: Context<CreateProject>,
        project_id: u64,
        name: String,
        description: String,
        location: String,
        project_type: ProjectType,
        verification_standard: String,
        estimated_credits: u64,
    ) -> Result<()> {
        require!(name.len() <= 50, CarbonCreditError::NameTooLong);
        require!(description.len() <= 200, CarbonCreditError::DescriptionTooLong);
        require!(location.len() <= 100, CarbonCreditError::LocationTooLong);

        let project = &mut ctx.accounts.project;
        let program_state = &mut ctx.accounts.program_state;

        project.project_id = project_id;
        project.name = name;
        project.description = description;
        project.location = location;
        project.project_type = project_type;
        project.verification_standard = verification_standard;
        project.estimated_credits = estimated_credits;
        project.issued_credits = 0;
        project.retired_credits = 0;
        project.owner = ctx.accounts.project_owner.key();
        project.status = ProjectStatus::Pending;
        project.created_at = Clock::get()?.unix_timestamp;
        project.verified_at = 0;
        project.bump = ctx.bumps.project;

        program_state.project_count += 1;

        Ok(())
    }

    pub fn verify_project(ctx: Context<VerifyProject>) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        require!(
            project.status == ProjectStatus::Pending,
            CarbonCreditError::ProjectAlreadyVerified
        );

        project.status = ProjectStatus::Verified;
        project.verified_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn issue_credits(
        ctx: Context<IssueCredits>,
        amount: u64,
        vintage_year: u16,
        metadata_uri: String,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        let program_state = &mut ctx.accounts.program_state;

        require!(
            project.status == ProjectStatus::Verified,
            CarbonCreditError::ProjectNotVerified
        );

        require!(
            project.issued_credits + amount <= project.estimated_credits,
            CarbonCreditError::ExceedsEstimatedCredits
        );

        let credit_batch = &mut ctx.accounts.credit_batch;
        credit_batch.project_id = project.project_id;
        credit_batch.batch_id = program_state.total_credits_issued;
        credit_batch.amount = amount;
        credit_batch.vintage_year = vintage_year;
        credit_batch.metadata_uri = metadata_uri;
        credit_batch.issued_at = Clock::get()?.unix_timestamp;
        credit_batch.retired_amount = 0;
        credit_batch.owner = ctx.accounts.recipient.key();
        credit_batch.bump = ctx.bumps.credit_batch;

        // Mint tokens to recipient
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, amount)?;

        project.issued_credits += amount;
        program_state.total_credits_issued += amount;

        Ok(())
    }

    pub fn retire_credits(ctx: Context<RetireCredits>, amount: u64, reason: String) -> Result<()> {
        let credit_batch = &mut ctx.accounts.credit_batch;
        let project = &mut ctx.accounts.project;
        let program_state = &mut ctx.accounts.program_state;

        require!(
            credit_batch.amount - credit_batch.retired_amount >= amount,
            CarbonCreditError::InsufficientCredits
        );

        // Burn tokens
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        let retirement = &mut ctx.accounts.retirement;
        retirement.batch_id = credit_batch.batch_id;
        retirement.amount = amount;
        retirement.reason = reason;
        retirement.retired_by = ctx.accounts.user.key();
        retirement.retired_at = Clock::get()?.unix_timestamp;
        retirement.bump = ctx.bumps.retirement;

        credit_batch.retired_amount += amount;
        project.retired_credits += amount;
        program_state.total_credits_retired += amount;

        Ok(())
    }

    pub fn transfer_credits(ctx: Context<TransferCredits>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.from_token_account.to_account_info(),
            to: ctx.accounts.to_token_account.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramState::INIT_SPACE,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct CreateProject<'info> {
    #[account(
        init,
        payer = project_owner,
        space = 8 + Project::INIT_SPACE,
        seeds = [b"project", project_id.to_le_bytes().as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub project_owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyProject<'info> {
    #[account(
        mut,
        seeds = [b"project", project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,
    #[account(
        constraint = authority.key() == program_state.authority @ CarbonCreditError::Unauthorized
    )]
    pub authority: Signer<'info>,
    pub program_state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
pub struct IssueCredits<'info> {
    #[account(
        mut,
        seeds = [b"project", project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,
    #[account(
        init,
        payer = authority,
        space = 8 + CreditBatch::INIT_SPACE,
        seeds = [b"credit_batch", program_state.total_credits_issued.to_le_bytes().as_ref()],
        bump
    )]
    pub credit_batch: Account<'info, CreditBatch>,
    #[account(mut)]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is the mint authority, validated by the mint account
    pub mint_authority: Signer<'info>,
    /// CHECK: This is the recipient of the tokens
    pub recipient: AccountInfo<'info>,
    #[account(
        mut,
        constraint = authority.key() == program_state.authority @ CarbonCreditError::Unauthorized
    )]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RetireCredits<'info> {
    #[account(
        mut,
        seeds = [b"credit_batch", credit_batch.batch_id.to_le_bytes().as_ref()],
        bump = credit_batch.bump
    )]
    pub credit_batch: Account<'info, CreditBatch>,
    #[account(
        mut,
        seeds = [b"project", project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub program_state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = user,
        space = 8 + Retirement::INIT_SPACE,
        seeds = [b"retirement", credit_batch.batch_id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub retirement: Account<'info, Retirement>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferCredits<'info> {
    #[account(mut)]
    pub from_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to_token_account: Account<'info, TokenAccount>,
    pub from_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub authority: Pubkey,
    pub total_credits_issued: u64,
    pub total_credits_retired: u64,
    pub project_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    pub project_id: u64,
    #[max_len(50)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    #[max_len(100)]
    pub location: String,
    pub project_type: ProjectType,
    #[max_len(50)]
    pub verification_standard: String,
    pub estimated_credits: u64,
    pub issued_credits: u64,
    pub retired_credits: u64,
    pub owner: Pubkey,
    pub status: ProjectStatus,
    pub created_at: i64,
    pub verified_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CreditBatch {
    pub project_id: u64,
    pub batch_id: u64,
    pub amount: u64,
    pub vintage_year: u16,
    #[max_len(200)]
    pub metadata_uri: String,
    pub issued_at: i64,
    pub retired_amount: u64,
    pub owner: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Retirement {
    pub batch_id: u64,
    pub amount: u64,
    #[max_len(200)]
    pub reason: String,
    pub retired_by: Pubkey,
    pub retired_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ProjectType {
    Reforestation,
    RenewableEnergy,
    EnergyEfficiency,
    WasteManagement,
    CarbonCapture,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ProjectStatus {
    Pending,
    Verified,
    Suspended,
}

// #[event]
// pub struct ProjectCreated {
//     pub project_id: u64,
//     pub owner: Pubkey,
//     pub name: String,
// }

// #[event]
// pub struct ProjectVerified {
//     pub project_id: u64,
//     pub verified_at: i64,
// }

// #[event]
// pub struct CreditsIssued {
//     pub project_id: u64,
//     pub batch_id: u64,
//     pub amount: u64,
//     pub recipient: Pubkey,
// }

// #[event]
// pub struct CreditsRetired {
//     pub batch_id: u64,
//     pub amount: u64,
//     pub retired_by: Pubkey,
//     pub reason: String,
// }

// #[event]
// pub struct CreditsTransferred {
//     pub from: Pubkey,
//     pub to: Pubkey,
//     pub amount: u64,
// }

#[error_code]
pub enum CarbonCreditError {
    #[msg("Name is too long")]
    NameTooLong,
    #[msg("Description is too long")]
    DescriptionTooLong,
    #[msg("Location is too long")]
    LocationTooLong,
    #[msg("Project is not verified")]
    ProjectNotVerified,
    #[msg("Project is already verified")]
    ProjectAlreadyVerified,
    #[msg("Amount exceeds estimated credits")]
    ExceedsEstimatedCredits,
    #[msg("Insufficient credits")]
    InsufficientCredits,
    #[msg("Unauthorized")]
    Unauthorized,
}
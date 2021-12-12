import { Address, BigInt, Bytes, Value, log } from "@graphprotocol/graph-ts";
import {
  ProposalCreated,
  ProposalCanceled,
  ProposalQueued,
  ProposalExecuted,
  VoteCast
} from "../generated/GovernorAlpha/GovernorAlpha";
import { VoteCast as VoteCastBravo } from "../generated/GovernorBravo/GovernorBravo";
import {
  DelegateChanged,
  DelegateVotesChanged,
  Transfer
} from "../generated/CompoundToken/CompoundToken";
import {
  getOrCreateTokenHolder,
  getOrCreateDelegate,
  getOrCreateProposal,
  getOrCreateVote,
  getGovernanceEntity
} from "./utils/helpers";
import {
  ZERO_ADDRESS,
  BIGINT_ONE,
  BIGINT_FIVE,
  BIGINT_ZERO,
  STATUS_ACTIVE,
  STATUS_QUEUED,
  STATUS_PENDING,
  STATUS_EXECUTED,
  STATUS_CANCELLED
} from "./utils/constants";
import { toDecimal } from "./utils/decimals";

// - event: ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)
//   handler: handleProposalCreated

export function handleProposalCreated(event: ProposalCreated): void {
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.id,
      event.transaction.hash.toHexString()
    )
  );
  let proposer = getOrCreateDelegate(
    event.params.proposer.toHexString(),
    false
  );

  // checking if the proposer was a delegate already accounted for, if not we should log an error
  // since it shouldn't be possible for a delegate to propose anything without first being "created"
  if (proposer == null) {
    log.error("Delegate {} not found on ProposalCreated. tx_hash: {}", [
      event.params.proposer.toHexString(),
      event.transaction.hash.toHexString()
    ]);
  }

  // Creating it anyway since we will want to account for this event data, even though it should've never happened
  proposer = getOrCreateDelegate(event.params.proposer.toHexString());

  proposal.proposer = proposer.id;
  proposal.targets = event.params.targets as Bytes[];
  proposal.values = event.params.values;
  proposal.signatures = event.params.signatures;
  proposal.calldatas = event.params.calldatas;
  proposal.creationBlock = event.block.number;
  proposal.creationTime = event.block.timestamp;
  proposal.startBlock = event.params.startBlock;
  proposal.endBlock = event.params.endBlock;
  proposal.description = event.params.description;
  proposal.status =
    event.block.number >= proposal.startBlock ? STATUS_ACTIVE : STATUS_PENDING;

  proposal.save();
}

// - event: ProposalCanceled(uint256)
//   handler: handleProposalCanceled

export function handleProposalCanceled(event: ProposalCanceled): void {
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.id,
      event.transaction.hash.toHexString()
    )
  );

  proposal.status = STATUS_CANCELLED;
  proposal.cancellationBlock = event.block.number;
  proposal.cancellationTime = event.block.timestamp;

  proposal.save();
}

// - event: ProposalQueued(uint256,uint256)
//   handler: handleProposalQueued

export function handleProposalQueued(event: ProposalQueued): void {
  let governance = getGovernanceEntity();
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.id,
      event.transaction.hash.toHexString()
    )
  );

  proposal.status = STATUS_QUEUED;
  proposal.executionETA = event.params.eta;
  proposal.save();

  governance.proposalsQueued = governance.proposalsQueued + BIGINT_ONE;
  governance.save();
}

// - event: ProposalExecuted(uint256)
//   handler: handleProposalExecuted

export function handleProposalExecuted(event: ProposalExecuted): void {
  let governance = getGovernanceEntity();
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.id,
      event.transaction.hash.toHexString()
    )
  );

  proposal.status = STATUS_EXECUTED;
  proposal.executionETA = null;
  proposal.executionBlock = event.block.number;
  proposal.executionTime = event.block.timestamp;
  
  proposal.save();

  governance.proposalsQueued = governance.proposalsQueued - BIGINT_ONE;
  governance.save();
}

// - event: VoteCast(address,uint256,bool,uint256)
//   handler: handleVoteCast

export function handleVoteCast(event: VoteCast): void {
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.proposalId,
      event.transaction.hash.toHexString()
    )
  );
  let voteId = event.params.voter
    .toHexString()
    .concat("-")
    .concat(event.params.proposalId.toString());
  let vote = getOrCreateVote(voteId);
  let voter = getOrCreateDelegate(event.params.voter.toHexString(), false);

  // checking if the voter was a delegate already accounted for, if not we should log an error
  // since it shouldn't be possible for a delegate to vote without first being "created"
  if (voter == null) {
    log.error("Delegate {} not found on VoteCast. tx_hash: {}", [
      event.params.voter.toHexString(),
      event.transaction.hash.toHexString()
    ]);
  }

  // Creating it anyway since we will want to account for this event data, even though it should've never happened
  voter = getOrCreateDelegate(event.params.voter.toHexString());

  vote.proposal = proposal.id;
  vote.voter = voter.id;
  vote.votesRaw = event.params.votes;
  vote.votes = toDecimal(event.params.votes);
  vote.support = event.params.support;

  vote.save();

  if (proposal.status == STATUS_PENDING) {
    proposal.status = STATUS_ACTIVE;
    proposal.save();
  }
}

// - event: VoteCastBravo(address,uint256,uint8,uint256)
//   handler: handleVoteCastBravo

export function handleVoteCastBravo(event: VoteCastBravo): void {
  let proposal = getOrCreateProposal(
    getProposalId(
      event.block.number,
      event.address,
      event.params.proposalId,
      event.transaction.hash.toHexString()
    )
  );
  let voteId = event.params.voter
    .toHexString()
    .concat("-")
    .concat(event.params.proposalId.toString());
  let vote = getOrCreateVote(voteId);
  let voter = getOrCreateDelegate(event.params.voter.toHexString(), false);

  // checking if the voter was a delegate already accounted for, if not we should log an error
  // since it shouldn't be possible for a delegate to vote without first being "created"
  if (voter == null) {
    log.error("Delegate {} not found on VoteCast. tx_hash: {}", [
      event.params.voter.toHexString(),
      event.transaction.hash.toHexString()
    ]);
  }

  // Creating it anyway since we will want to account for this event data, even though it should've never happened
  voter = getOrCreateDelegate(event.params.voter.toHexString());

  vote.proposal = proposal.id;
  vote.voter = voter.id;
  vote.votesRaw = event.params.votes;
  vote.votes = toDecimal(event.params.votes);
  vote.support = event.params.support === 1;

  vote.save();

  if (proposal.status == STATUS_PENDING) {
    proposal.status = STATUS_ACTIVE;
    proposal.save();
  }
}

// - event: DelegateChanged(indexed address,indexed address,indexed address)
//   handler: handleDelegateChanged

export function handleDelegateChanged(event: DelegateChanged): void {
  let tokenHolder = getOrCreateTokenHolder(
    event.params.delegator.toHexString()
  );
  let previousDelegate = getOrCreateDelegate(
    event.params.fromDelegate.toHexString()
  );
  let newDelegate = getOrCreateDelegate(event.params.toDelegate.toHexString());

  tokenHolder.delegate = newDelegate.id;
  tokenHolder.save();

  previousDelegate.tokenHoldersRepresentedAmount =
    previousDelegate.tokenHoldersRepresentedAmount - 1;
  newDelegate.tokenHoldersRepresentedAmount =
    newDelegate.tokenHoldersRepresentedAmount + 1;
  previousDelegate.save();
  newDelegate.save();
}

// - event: DelegateVotesChanged(indexed address,uint256,uint256)
//   handler: handleDelegateVotesChanged

export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  let governance = getGovernanceEntity();
  let delegate = getOrCreateDelegate(event.params.delegate.toHexString());
  let votesDifference = event.params.newBalance - event.params.previousBalance;

  delegate.delegatedVotesRaw = event.params.newBalance;
  delegate.delegatedVotes = toDecimal(event.params.newBalance);
  delegate.save();

  if (
    event.params.previousBalance == BIGINT_ZERO &&
    event.params.newBalance > BIGINT_ZERO
  ) {
    governance.currentDelegates = governance.currentDelegates + BIGINT_ONE;
  }
  if (event.params.newBalance == BIGINT_ZERO) {
    governance.currentDelegates = governance.currentDelegates - BIGINT_ONE;
  }
  governance.delegatedVotesRaw = governance.delegatedVotesRaw + votesDifference;
  governance.delegatedVotes = toDecimal(governance.delegatedVotesRaw);
  governance.save();
}

// - event: Transfer(indexed address,indexed address,uint256)
//   handler: handleTransfer

export function handleTransfer(event: Transfer): void {
  let fromHolder = getOrCreateTokenHolder(event.params.from.toHexString());
  let toHolder = getOrCreateTokenHolder(event.params.to.toHexString());
  let governance = getGovernanceEntity();

  // fromHolder
  if (event.params.from.toHexString() != ZERO_ADDRESS) {
    let fromHolderPreviousBalance = fromHolder.tokenBalanceRaw;
    fromHolder.tokenBalanceRaw =
      fromHolder.tokenBalanceRaw - event.params.amount;
    fromHolder.tokenBalance = toDecimal(fromHolder.tokenBalanceRaw);

    if (fromHolder.tokenBalanceRaw < BIGINT_ZERO) {
      log.error("Negative balance on holder {} with balance {}", [
        fromHolder.id,
        fromHolder.tokenBalanceRaw.toString()
      ]);
    }

    if (
      fromHolder.tokenBalanceRaw == BIGINT_ZERO &&
      fromHolderPreviousBalance > BIGINT_ZERO
    ) {
      governance.currentTokenHolders =
        governance.currentTokenHolders - BIGINT_ONE;
      governance.save();
    } else if (
      fromHolder.tokenBalanceRaw > BIGINT_ZERO &&
      fromHolderPreviousBalance == BIGINT_ZERO
    ) {
      governance.currentTokenHolders =
        governance.currentTokenHolders + BIGINT_ONE;
      governance.save();
    }

    fromHolder.save();
  }

  // toHolder
  let toHolderPreviousBalance = toHolder.tokenBalanceRaw;
  toHolder.tokenBalanceRaw = toHolder.tokenBalanceRaw + event.params.amount;
  toHolder.tokenBalance = toDecimal(toHolder.tokenBalanceRaw);
  toHolder.totalTokensHeldRaw =
    toHolder.totalTokensHeldRaw + event.params.amount;
  toHolder.totalTokensHeld = toDecimal(toHolder.totalTokensHeldRaw);

  if (
    toHolder.tokenBalanceRaw == BIGINT_ZERO &&
    toHolderPreviousBalance > BIGINT_ZERO
  ) {
    governance.currentTokenHolders =
      governance.currentTokenHolders - BIGINT_ONE;
    governance.save();
  } else if (
    toHolder.tokenBalanceRaw > BIGINT_ZERO &&
    toHolderPreviousBalance == BIGINT_ZERO
  ) {
    governance.currentTokenHolders =
      governance.currentTokenHolders + BIGINT_ONE;
    governance.save();
  }
  toHolder.save();
}

function getProposalId(
  block: BigInt,
  contract: Address | null,
  baseId: BigInt,
  txHash: String
): String {
  if (
    contract == Address.fromString("0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F")
  ) {
    if (block > BigInt.fromI32(12686655)) {
      log.error("Old governance used after transition. tx_hash: {}", [txHash]);
      return null;
    } else {
      return baseId.toString();
    }
  } else if (
    contract == Address.fromString("0xC4e172459f1E7939D522503B81AFAaC1014CE6F6")
  ) {
    if (block > BigInt.fromI32(13284644)) {
      log.error("Old governance used after transition. tx_hash: {}", [txHash]);
      return null;
    } else {
      let newId = baseId + BIGINT_FIVE;
      return newId.toString();
    }
  } else if (
    contract == Address.fromString("0x408ED6354d4973f66138C91495F2f2FCbd8724C3")
  ) {
    return baseId.toString();
  } else {
    log.error("Fatal error, get proposal id fault. Tx hash: {}", [txHash]);
    return null;
  }
}

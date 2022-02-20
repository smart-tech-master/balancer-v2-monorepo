import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { deploy, deployedAt } from '@balancer-labs/v2-helpers/src/contract';
import { actionId } from '@balancer-labs/v2-helpers/src/models/misc/actions';

import Vault from '@balancer-labs/v2-helpers/src/models/vault/Vault';
import TokenList from '@balancer-labs/v2-helpers/src/models/tokens/TokenList';
import { expectBalanceChange } from '@balancer-labs/v2-helpers/src/test/tokenBalance';
import { Contract } from 'ethers';
import { expect } from 'chai';
import Token from '@balancer-labs/v2-helpers/src/models/tokens/Token';

describe('BALTokenHolder', function () {
  let tokens: TokenList;
  let BAL: Token;
  let vault: Vault;
  let holder: Contract;
  let admin: SignerWithAddress, authorized: SignerWithAddress, other: SignerWithAddress;

  const holderName = 'DAO Treasury';

  before('get signers', async () => {
    [, admin, authorized, other] = await ethers.getSigners();
  });

  sharedBeforeEach(async () => {
    // Deploy Balancer Vault
    vault = await Vault.create({ admin });

    // Deploy BAL token
    tokens = await TokenList.create([{ symbol: 'BAL' }]);
    BAL = await tokens.findBySymbol('BAL');

    holder = await deploy('BALTokenHolder', { args: [BAL.address, vault.address, holderName] });

    // Deposit BAL in the holder
    await BAL.mint(holder);
  });

  it('returns the BAL address', async () => {
    expect(await holder.getBalancerToken()).to.equal(BAL.address);
  });

  it('returns the address of the vault', async () => {
    expect(await holder.getVault()).to.equal(vault.address);
  });

  it('returns its name', async () => {
    expect(await holder.getName()).to.equal(holderName);
  });

  context('when the caller is authorized', () => {
    sharedBeforeEach(async () => {
      const authorizer = await deployedAt('v2-vault/Authorizer', await vault.instance.getAuthorizer());
      const withdrawActionId = await actionId(holder, 'withdrawFunds');
      await authorizer.connect(admin).grantPermissions([withdrawActionId], authorized.address, [holder.address]);
    });

    it('sends funds to the recipient', async () => {
      await expectBalanceChange(() => holder.connect(authorized).withdrawFunds(other.address, 100), tokens, {
        account: other.address,
        changes: { BAL: 100 },
      });
    });
  });

  context('when the caller is not authorized', () => {
    it('reverts', async () => {
      await expect(holder.connect(other).withdrawFunds(other.address, 100)).to.be.revertedWith('SENDER_NOT_ALLOWED');
    });
  });
});
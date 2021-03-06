"use strict"

import { calculateShares, calculateTokens } from "scripts/common"
export default ({ node }) => {
  let emptyState = {
    loading: false,
    loadedOnce: false,

    // our delegations, maybe not yet committed
    delegates: [],

    // our delegations which are already on the blockchain
    committedDelegates: {},
    unbondingDelegations: {}
  }
  const state = JSON.parse(JSON.stringify(emptyState))

  const mutations = {
    addToCart(state, delegate) {
      // don't add to cart if already in cart
      for (let existingDelegate of state.delegates) {
        if (delegate.id === existingDelegate.id) return
      }

      state.delegates.push({
        id: delegate.id,
        delegate: Object.assign({}, delegate),
        atoms: 0
      })
    },
    removeFromCart(state, delegate) {
      state.delegates = state.delegates.filter(c => c.id !== delegate)
    },
    setCommittedDelegation(state, { candidateId, value }) {
      let committedDelegates = Object.assign({}, state.committedDelegates)
      if (value === 0) {
        delete committedDelegates[candidateId]
      } else {
        committedDelegates[candidateId] = value
      }
      state.committedDelegates = committedDelegates
    },
    setUnbondingDelegations(state, { validator_addr, min_time, balance }) {
      let unbondingDelegations = Object.assign({}, state.unbondingDelegations)
      if (balance.amount === 0) {
        delete unbondingDelegations[validator_addr]
      } else {
        unbondingDelegations[validator_addr] = { min_time, balance }
      }
      state.unbondingDelegations = unbondingDelegations
    }
  }

  let actions = {
    reconnected({ state, dispatch }) {
      if (state.loading) {
        dispatch(`getBondedDelegates`)
      }
    },
    resetSessionData({ rootState }) {
      rootState.delegation = JSON.parse(JSON.stringify(emptyState))
    },
    // load committed delegations from LCD
    async getBondedDelegates(
      { state, rootState, commit, dispatch },
      candidates
    ) {
      state.loading = true
      let address = rootState.user.address
      candidates = candidates || (await dispatch(`getDelegates`))

      let delegator = await node.getDelegator(address)
      // the request runs that long, that the user might sign out and back in again
      // the result is, that the new users state gets updated by the old users request
      // here we check if the user is still the same
      if (rootState.user.address !== address) return

      if (delegator.delegations) {
        delegator.delegations.forEach(({ validator_addr, shares }) => {
          commit(`setCommittedDelegation`, {
            candidateId: validator_addr,
            value: parseFloat(shares)
          })
          if (shares > 0) {
            const delegate = candidates.find(
              ({ owner }) => owner === validator_addr // this should change to address instead of owner
            )
            commit(`addToCart`, delegate)
          }
        })
      }
      // delete delegations not present anymore
      Object.keys(state.committedDelegates).forEach(validatorAddr => {
        if (
          !delegator.delegations ||
          !delegator.delegations.find(
            ({ validator_addr }) => validator_addr === validatorAddr
          )
        )
          commit(`setCommittedDelegation`, {
            candidateId: validatorAddr,
            value: 0
          })
      })

      if (delegator.unbonding_delegations) {
        delegator.unbonding_delegations.forEach(
          ({ validator_addr, balance, min_time }) => {
            commit(`setUnbondingDelegations`, {
              validator_addr,
              balance,
              min_time
            })
          }
        )
      }
      // delete undelegations not present anymore
      Object.keys(state.unbondingDelegations).forEach(validatorAddr => {
        if (
          !delegator.unbonding_delegations ||
          !delegator.unbonding_delegations.find(
            ({ validator_addr }) => validator_addr === validatorAddr
          )
        )
          commit(`setUnbondingDelegations`, {
            validator_addr: validatorAddr,
            balance: { amount: 0 }
          })
      })

      state.loadedOnce = true
      state.loading = false
    },
    async updateDelegates({ dispatch }) {
      let candidates = await dispatch(`getDelegates`)
      return dispatch(`getBondedDelegates`, candidates)
    },
    async submitDelegation(
      {
        rootState: { config, user, wallet },
        state,
        dispatch,
        commit
      },
      { stakingTransactions }
    ) {
      const denom = config.bondingDenom.toLowerCase()
      const delegatorAddr = wallet.address
      // delegations = [], unbondings = [], redelegations = []

      const mappedDelegations =
        stakingTransactions.delegations &&
        stakingTransactions.delegations.map(({ atoms, validator }) => ({
          delegator_addr: delegatorAddr,
          validator_addr: validator.owner,
          delegation: {
            denom,
            amount: String(atoms)
          }
        }))

      const mappedUnbondings =
        stakingTransactions.unbondings &&
        stakingTransactions.unbondings.map(({ atoms, validator }) => ({
          delegator_addr: delegatorAddr,
          validator_addr: validator.owner,
          shares: String(Math.abs(calculateShares(validator, atoms)).toFixed(8)) // TODO change to 10 when available https://github.com/cosmos/cosmos-sdk/issues/2317
        }))

      const mappedRedelegations =
        stakingTransactions.redelegations &&
        stakingTransactions.redelegations.map(
          ({ atoms, validatorSrc, validatorDst }) => ({
            delegator_addr: delegatorAddr,
            validator_src_addr: validatorSrc.owner,
            validator_dst_addr: validatorDst.owner,
            shares: String(calculateShares(validatorSrc, atoms).toFixed(8)) // TODO change to 10 when available https://github.com/cosmos/cosmos-sdk/issues/2317
          })
        )

      await dispatch(`sendTx`, {
        type: `updateDelegations`,
        to: wallet.address, // TODO strange syntax
        delegations: mappedDelegations,
        begin_unbondings: mappedUnbondings,
        begin_redelegates: mappedRedelegations
      })

      if (mappedDelegations) {
        // (optimistic update) we update the atoms of the user before we get the new values from chain
        let atomsDiff =
          stakingTransactions.delegations &&
          stakingTransactions.delegations
            // compare old and new delegations and diff against old atoms
            .map(
              delegation =>
                calculateTokens(
                  delegation.validator,
                  state.committedDelegates[delegation.validator.owner]
                ) - delegation.atoms
            )
            .reduce((sum, diff) => sum + diff, 0)
        commit(`setAtoms`, user.atoms + atomsDiff)
      }

      // we optimistically update the committed delegations
      // TODO usually I would just query the new state through the LCD and update the state with the result, but at this point we still get the old shares
      setTimeout(async () => {
        dispatch(`updateDelegates`) //.then(() =>
        // updateCommittedDelegations(
        //   delegations,
        //   commit
        // )
        // )
      }, 5000)
    },
    async endUnbonding({ rootState, state, dispatch, commit }, validatorAddr) {
      try {
        await dispatch(`sendTx`, {
          type: `updateDelegations`,
          to: rootState.wallet.address, // TODO strange syntax
          complete_unbondings: [
            {
              delegator_addr: rootState.wallet.address,
              validator_addr: validatorAddr
            }
          ]
        })

        let balance = state.unbondingDelegations[validatorAddr].balance
        commit(`setUnbondingDelegations`, {
          validator_addr: validatorAddr,
          balance: { amount: 0 }
        })
        commit(`notify`, {
          title: `Ending undelegation successful`,
          body: `You successfully undelegated ${balance.amount} ${
            balance.denom
          }s from ${validatorAddr}`
        })
      } catch (err) {
        commit(`notifyError`, {
          title: `Ending undelegation failed`,
          body: err
        })
      }
    }
  }

  return {
    state,
    mutations,
    actions
  }
}
// needed for optimistic updates, uncomment or delete this when that issue is addressed
// function updateCommittedDelegations(delegations, commit) {
//   for (let delegation of delegations) {
//     commit("setCommittedDelegation", {
//       candidateId: delegation.delegate.owner,
//       value: delegation.atoms
//     })
//   }
// }

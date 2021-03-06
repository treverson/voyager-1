<template lang='pug'>
.tm-connected-network#tm-connected-network(v-if='connected' :class="cssClass")
  .tm-connected-network__connection
    .tm-connected-network__icon#tm-connected-network__icon: i.material-icons lock
    .tm-connected-network__string#tm-connected-network__string
      span.chain-id(v-tooltip.top="networkTooltip") {{ chainId }}
  .tm-connected-network__string#tm-connected-network__block
    span(v-if="mockedConnector" v-tooltip.top="'Current block number'") {{ blockHeight }}
    a(:href="explorerLink" v-if="!mockedConnector" v-tooltip.top="'View block details on the Cosmos explorer.'") {{ blockHeight }}
      i.material-icons.exit exit_to_app
.tm-connected-network.tm-disconnected-network#tm-disconnected-network(v-else)
  img(class="tm-connected-network-loader" src="~assets/images/loader.svg")
  .tm-connected-network__string.tm-connected-network__string--connecting(v-tooltip.top="networkTooltip") Connecting to {{ chainId }}&hellip;
</template>

<script>
import { mapGetters } from "vuex"
import num from "scripts/num"
import { startCase, toLower } from "lodash"
export default {
  name: `tm-connected-network`,
  computed: {
    ...mapGetters([`lastHeader`, `nodeIP`, `connected`, `mockedConnector`]),
    cssClass() {
      if (this.mockedConnector) {
        return `tm-connected-network--mocked`
      }
    },

    networkTooltip({ mockedConnector, connected, nodeIP, chainId } = this) {
      if (mockedConnector) {
        return `You\'re using the offline demo and are not connected to any real nodes.`
      } else if (connected) {
        return `You\'re connected to the ${chainId} testnet via node ${nodeIP}.`
      } else if (!mockedConnector && !connected) {
        return `We\'re pinging nodes to try to connect you to ${chainId}.`
      }
    },

    chainId() {
      if (this.mockedConnector) {
        return startCase(toLower(this.lastHeader.chain_id))
      }

      return this.lastHeader.chain_id
    },
    blockHeight() {
      return `#` + num.prettyInt(this.lastHeader.height)
    },
    explorerLink() {
      return `https://explorecosmos.network/blocks/` + this.lastHeader.height
    }
  },
  data: () => ({
    num: num,
    onPreferencesPage: false
  }),
  methods: {
    closeMenu() {
      this.$store.commit(`setActiveMenu`, ``)
    }
  },
  watch: {
    "$route.name"(newName) {
      this.onPreferencesPage = newName === `preferences`
    }
  }
}
</script>

<style lang="stylus">
@require '~variables'

.tm-connected-network
  align-items center
  background var(--app-fg)
  border-radius 0.25rem
  color var(--dim)
  display flex
  font-size sm
  justify-content space-between
  margin 0.5rem
  padding 0.5rem

  .chain-id
    font-weight 500
    padding-right 1rem

  .exit
    font-size sm

.tm-connected-network__icon
  align-items center
  color var(--success-bc)
  display flex
  font-size m
  justify-content center
  padding-right 0.25rem

  .fa-spin
    color var(--warning)

.tm-connected-network--mocked
  .tm-connected-network__icon
    color var(--warning)

.tm-connected-network__connection
  display flex

.tm-disconnected-network
  justify-content start

.tm-connected-network__string--connecting
  color var(--warning)

.tm-connected-network-loader
  height 1rem
  margin-right 0.5rem
  width 1rem
</style>

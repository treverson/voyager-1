<template lang="pug">
tm-page(title='New Proposal')
  div(slot="menu"): vm-tool-bar
    router-link(to="/proposals" exact v-tooltip.bottom="'Back'")
      i.material-icons arrow_back
  tm-part(title='Choose a Type')
    tm-list-item(title='Adjust Parameters' to="/proposals/new/adjust")
    tm-list-item(title='Amend Constitution' to="/proposals/new/amend")
    tm-list-item(:title='`Create ${bondingDenom}s`' to="/proposals/new/create")
    tm-list-item(title='Plain Text' to="/proposals/new/text")
    tm-list-item(title='Upgrade Code' to="/proposals/new/upgrade")
</template>

<script>
import { mapGetters } from "vuex"
import { TmListItem, TmPage, TmPart } from "@tendermint/ui"
import VmToolBar from "common/VmToolBar"
export default {
  name: `page-proposals-new`,
  computed: {
    ...mapGetters([`bondingDenom`])
  },
  components: {
    TmListItem,
    TmPage,
    TmPart,
    VmToolBar
  }
}
</script>

export default {
  setupComponent(args, component) {
    component.set('showAvatar', args.model.get('isDiscovery'))
  }
}

import topicIconClass from '../../lib/topic-icon';

export default {
  setupComponent(args, component) {
    const topicIcon = topicIconClass(args.model.get('type'))
    component.set('topicIcon', topicIcon)
  }
}

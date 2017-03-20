import topicIconClass from '../../lib/topic-icon';

export default {
  setupComponent(args, component) {
    const topicIcon = topicIconClass(args.model.get('subtype'))
    component.set('topicIcon', topicIcon)
  }
}

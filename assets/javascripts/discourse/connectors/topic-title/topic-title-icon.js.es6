import { topicIconClass } from '../../lib/dc-utilities';

export default {
  setupComponent(args, component) {
    const topicIcon = topicIconClass(args.model.get('subtype'))
    component.set('topicIcon', topicIcon)
  }
}

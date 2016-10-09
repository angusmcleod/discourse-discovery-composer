# name: discourse-discovery-composer
# about: Adds a composer to the discovery stream
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/discovery-composer-desktop.scss'

after_initialize do

  PostRevisor.track_topic_field(:wiki)

  DiscourseEvent.on(:post_created) do |post, opts, user|
    if post.is_first_post?
      topic = Topic.find(post.topic_id)
      type = opts[:tags].first
      if type == 'wiki'
        post.wiki = true
        post.save
      end
      topic.custom_fields['topic_type'] = type
      topic.save!
    end
  end
end

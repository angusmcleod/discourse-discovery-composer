# name: discourse-discovery-composer
# about: Adds a composer to the discovery stream
# version: 0.1
# authors: Angus McLeod

register_asset 'stylesheets/discovery-composer.scss'

after_initialize do

  require 'similar_topics_controller'
  class ::SimilarTopicsController
    def index
      puts
      if params.respond_to?(:raw)
        super
      else
        params.require(:title)
        title = params[:title]
        categoryId = params[:category_id]
        invalid_length = check_invalid_length('title', params[:title])

        return render json: [] if invalid_length || !Topic.count_exceeds_minimum?

        topics = Topic.similar_title_to(title, categoryId, current_user).to_a
        topics.map! {|t| SimilarTopic.new(t) }
        render_serialized(topics, SimilarTopicSerializer, root: :similar_topics, rest_serializer: true)
      end
    end
  end

  require 'topic'
  require 'search'
  class ::Topic
    def self.similar_title_to(title, categoryId, user=nil)
      return [] unless title.present?

      filter_words = Search.prepare_data(title);
      ts_query = Search.ts_query(filter_words, nil, "|")

      candidates = Topic.visible
         .secured(Guardian.new(user))
         .listable_topics
         .joins('JOIN topic_search_data s ON topics.id = s.topic_id')
         .where("search_data @@ #{ts_query}")
         .order("ts_rank(search_data, #{ts_query}) DESC")
         .limit(SiteSetting.max_similar_results * 3)

      exclude_topic_ids = Category.pluck(:topic_id).compact!
      if exclude_topic_ids.present?
        candidates = candidates.where("topics.id NOT IN (?)", exclude_topic_ids)
      end

      if categoryId.present? && SiteSetting.composer_limit_similarity_to_category
        candidates = candidates.where("category_id = categoryId")
      end

      candidate_ids = candidates.pluck(:id)

      return [] unless candidate_ids.present?

      similar = Topic.select(sanitize_sql_array(["topics.*, similarity(topics.title, :title) AS similarity, p.cooked as blurb", title: title]))
                       .joins("JOIN posts AS p ON p.topic_id = topics.id AND p.post_number = 1")
                       .limit(SiteSetting.max_similar_results)
                       .where("topics.id IN (?)", candidate_ids)
                       .where("similarity(topics.title, :title) > 0.2", title: title)
                       .order('similarity desc')

      similar
    end
  end
end

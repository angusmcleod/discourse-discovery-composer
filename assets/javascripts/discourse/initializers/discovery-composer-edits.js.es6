import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import ComposerTitle from 'discourse/components/composer-title';
import ComposerMessages from 'discourse/components/composer-messages';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import DiscoveryRoute from 'discourse/routes/application';
import TopicRoute from 'discourse/routes/topic';
import TopicAdapter from 'discourse/adapters/topic';
import { ajax } from 'discourse/lib/ajax';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';

const styleStates = {
  initial: () => {
    $('#reply-control').find('.reply-to, .topic-type-choice, .wmd-controls, .submit-panel').hide();
    $('#reply-control').css('height', '48px');
  },
  input: () => {
    $('#reply-control').find('.input-tip').show();
    $('#reply-control').css('height', '75px');
  },
  similar: () => {
    $('#reply-control').css('height', $('.similar-title-topics').height() + 70);
  },
  full: () => {
    $('#reply-control').css('height', '400px');
    $('#reply-control').find('.wmd-controls').show();
    Ember.run.later((function() {
      $('#reply-control').find('.submit-panel').show();
    }), 300);
  },
  types: () => {
    $('#reply-control').find('.topic-type-choice').show();
    $('#reply-control').css('height', '90px');
  }
}

export default {
  name: 'discovery-compose',
  initialize(){

    Composer.reopen({
      showCategoryChooser: false,
      bodyState: 'initial',
      similarTitleTopics: Ember.A()
    })

    ComposerTitle.reopen({
      @on('didInsertElement')
      setupProcessTitle() {
        $('#reply-title').on('keydown', Ember.run.bind(this, this.processTitle));
      },

      processTitle(event) {
        if (event.keyCode === 13) {
          if (this.get('validation')) {
            this.set('validation.lastShownAt', true)
          } else {
            this.appEvents.trigger("composer:valid-title");
          }
        }
      },

      @on('willDestroy')
      destroyProcessTitle() {
        $('#reply-title').off('keydown', Ember.run.bind(this, this.processTitle));
      }
    })

    ComposerMessages.reopen({
      _lastTitleSimilaritySearch: null,

      @on('didInsertElement')
      watchValidTitle() {
        this.appEvents.on('composer:valid-title', this, this._handleValidTitle);
      },

      @on('willDestroyElement')
      destroyValidTitle() {
        this.appEvents.off('composer:valid-title', this, this._handleValidTitle);
      },

      _handleValidTitle() {
        const composer = this.get('composer');

        // We don't care about similar topics unless creating a topic
        if (!composer.get('creatingTopic')) { return; }

        const title = composer.get('title') || '';
        const categoryId = composer.get('categoryId') || '';

        // Ensure the fields are of the minimum length
        if (title.length < Discourse.SiteSettings.min_title_similar_length) { return; }

        // Don't search over and over
        if (title === this._lastTitleSimilaritySearch) { return; }
        this._lastTitleSimilaritySearch = title;

        const similarTitleTopics = composer.get('similarTitleTopics');

        composer.store.find('similar-topic', {title, categoryId}).then(newTopics => {
          similarTitleTopics.clear();
          similarTitleTopics.pushObjects(newTopics.get('content'));

          if (similarTitleTopics.get('length') > 0) {
            composer.set('bodyState', 'similar');
          } else {
            this.appEvents.trigger('composer:accept-title');
          }
        });
      }
    })

    ComposerBody.reopen({
      titleValid: false,

      @on('init')
      @observes('composer.bodyState,composer.similarTitleTopics.[]')
      handleBodyState() {
        const state = this.get('composer.bodyState')
        if (state) {
          Ember.run.scheduleOnce('afterRender', this, function() {
            styleStates[state]()
          })
        }
      },

      @on('didInsertElement')
      showHideComposeBody() {
        if (window.location.pathname.indexOf('/t/') === -1) {
          this.setup();
          $(document).on('click', Ember.run.bind(this, this.handleClick));
          $(document).on('resize', Ember.run.bind(this, this.handleWindowResize));
          this.appEvents.on('composer:accept-title', this, this.handleAcceptTitle);
        }
      },

      handleClick(event) {
        if (event.target.id === 'reply-title' && this.get('composer.bodyState') === 'initial') {
          this.set('composer.bodyState', 'input');
        }
        if (!$(event.target).closest(this.$()).length) {
          this.set('composer.bodyState', 'initial');
        }
      },

      handleWindowResize(event) {
        let titleWidth = $('.title-input').width() - 21;
        $('#reply-title').css('width', `${titleWidth}px`)
      },

      handleAcceptTitle(event) {
        this.set('composer.bodyState', 'full');;
      },

      setup() {
        this.resizeControls();
        this.set('composer.bodyState', 'initial')
      },

      resizeControls() {
        let self = this;
        Ember.run.scheduleOnce('afterRender', this, function() {
          const fieldsHeight = self.$('.composer-fields').height();
          self.$('.wmd-controls').css('top', `${fieldsHeight}px`)
        })
      },

      @on('willDestroy')
      destroyExpandEvent() {
        $(document).off('click', Ember.run.bind(this, this.handleClick));
        $(document).off('resize', Ember.run.bind(this, this.handleResize));
      }
    })

    TopicStatusView.reopen({
      renderDiv: true,

      @observes('statuses')
      @on('init')
      _setup(){
        let type = this.get('topic.type')
        let topicIcon = {
          icon: topicIconClass(type),
          title: I18n.t("topic." + type + ".title"),
          openTag: 'span',
          closeTag: 'span'
        }
        this.get('statuses').pushObject(topicIcon)
      }
    })

    DiscoveryRoute.reopen({
      firstRenderDiscovery: false,
      transitionToDiscovery: false,

      disconnectComposer: function() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      },

      isDiscoveryPath: function() {
        const pathSlug = window.location.pathname.split('/')[1];
        const filters = Discourse.Site.currentProp('filters');
        let filterPath = pathSlug === '' || filters.filter(function(filter) {
                           return pathSlug === filter;
                         }).length > 0;
        let categoryPath = pathSlug === 'c';
        let categoriesPath = pathSlug === 'categories';
        return filterPath || categoryPath || categoriesPath
      },

      renderTemplate(controller, model) {
        this._super();
        if (this.currentUser && this.isDiscoveryPath()) {
          this.disconnectComposer();
          this.set('firstRenderDiscovery', true)
        }
      },

      actions: {

        didTransition: function() {
          this._super();
          if (this.currentUser && (this.get('firstRenderDiscovery') || this.get('transitionToDiscovery'))) {
            this.openComposer(this.controllerFor("discovery/topics"));
            this.setProperties({
              'firstRenderDiscovery': false,
              'transitionToDiscovery': false
            })
          }
          return true; // Bubble the didTransition event
        },

        willTransition: function(transition) {
          if (this.currentUser) {
            if (transition.targetName.indexOf('discovery') > -1) {
              this.disconnectComposer();
              this.set('transitionToDiscovery', true)
            } else {
              this.controllerFor('composer').shrink();
              this.set('transitionToDiscovery', false)
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {into: 'application', outlet: 'composer'})
        }
      },

      @on('deactivate')
      removeComposer() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      }
    })
  }
};

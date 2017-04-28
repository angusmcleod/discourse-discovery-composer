import ApplicationRoute from 'discourse/routes/application';
import DiscoveryRoute from 'discourse/routes/discovery';
import TopicRoute from 'discourse/routes/topic';
import Composer from 'discourse/models/composer';
import { on } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'dc-route-edits',
  initialize(){
    ApplicationRoute.reopen({
      renderTemplate() {
        this._super();
        // using disconnectOutlet here results in ad hoc errors, a placeholder is more stable;
        this.render('placeholder', { into: 'application', outlet: 'composer' });
      }
    })

    DiscoveryRoute.reopen({
      getController: function() {
        const path = window.location.pathname.split('/')[1];
        let controllerName = path === 'categories' ? "discovery/categories" : "discovery/topics";
        return this.controllerFor(controllerName);
      },

      openDiscoveryComposer: function() {
        this.render('composer', { outlet: 'discovery-composer', into: 'sidebar-wrapper'})
        const controller = this.getController();
        this.controllerFor('composer').open({
          categoryId: controller.get('category.id'),
          action: Composer.CREATE_TOPIC,
          draftKey: controller.get('model.draft_key'),
          draftSequence: controller.get('model.draft_sequence'),
          isDiscovery: true
        });
      },

      closeDiscoveryComposer: function() {
        this.disconnectOutlet({ outlet: 'discovery-composer', parentView: 'sidebar-wrapper'})
        const composer = this.controllerFor('composer');
        composer.set('model.isDiscovery', false);
        composer.shrink();
      },

      actions: {
        didTransition: function(transition) {
          this._super();
          if (this.currentUser) this.openDiscoveryComposer();
          return true;
        },

        willTransition: function(transition) {
          this._super();
          if (this.currentUser) {
            if (!transition || transition.targetName.indexOf('discovery') === -1) {
              this.closeDiscoveryComposer();
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {
            into: 'application',
            outlet: 'composer'
          })
        }
      },

      @on('deactivate')
      removeComposer() {
        if (this.currentUser) {
          this.render('placeholder', {
            into: 'application',
            outlet: 'composer'
          })
        }
      }
    })
  }
}

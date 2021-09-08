import { BotConfig } from 'botpress/sdk'
import _ from 'lodash'
import { StudioServices } from 'studio/studio-router'
import { CustomStudioRouter } from 'studio/utils/custom-studio-router'

class ManageRouter extends CustomStudioRouter {
  constructor(services: StudioServices) {
    super('Manage', services)
  }

  setupRoutes() {
    const router = this.router

    router.get(
      '/bots/templates',
      this.asyncMiddleware(async (_req, res, _next) => {
        res.send(await this.botService.getBotTemplates())
      })
    )

    router.post(
      '/bots/create',
      this.checkTokenHeader,
      this.needPermissions('write', 'admin.bots'),
      this.asyncMiddleware(async (req, res) => {
        const bot = <BotConfig>_.pick(req.body, ['id', 'name', 'category', 'defaultLanguage'])

        const botExists = (await this.botService.getBotsIds()).includes(bot.id)
        const botLinked = (await this.workspaceService.getBotRefs()).includes(bot.id)

        bot.id = await this.botService.makeBotId(bot.id, req.workspace!)

        if (botExists && botLinked) {
          throw new Error(`Bot "${bot.id}" already exists and is already linked in workspace`)
        }

        if (botExists) {
          this.logger.warn(`Bot "${bot.id}" already exists. Linking to workspace`)
        } else {
          const pipeline = await this.workspaceService.getPipeline(req.workspace!)

          bot.pipeline_status = {
            current_stage: {
              id: pipeline![0].id,
              promoted_on: new Date(),
              promoted_by: req.tokenUser!.email
            }
          }
          await this.botService.addBot(bot, req.body.template)
        }

        if (botLinked) {
          this.logger.warn(`Bot "${bot.id}" already linked in workspace. See workspaces.json for more details`)
        } else {
          await this.workspaceService.addBotRef(bot.id, req.workspace!)
        }

        res.sendStatus(200)
      })
    )
  }
}

export default ManageRouter
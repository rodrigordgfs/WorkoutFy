import fp from 'fastify-plugin'

import { createUsersRepository } from '../modules/users/repository.js'
import { createUsersService } from '../modules/users/service.js'

export default fp(async function currentUserPlugin(app) {
  const usersService = createUsersService(createUsersRepository(() => app.prisma))

  app.decorateRequest('currentUser', null)
  app.decorate('syncCurrentUser', usersService.syncCurrentUser)
  app.decorate('requireCurrentUser', async function requireCurrentUser(request) {
    const currentUser = await app.syncCurrentUser(request)
    request.currentUser = currentUser

    return currentUser
  })
  app.decorate('updateCurrentUserProfile', usersService.updateCurrentUserProfile)
})

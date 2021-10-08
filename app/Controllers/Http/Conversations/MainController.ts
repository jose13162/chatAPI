import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { Conversation } from "App/Models";
import { StoreValidator } from "App/Validators/Conversations";

export default class MainController {
  public async index({ request, response, auth }: HttpContextContract) {
    let { page, perPage } = request.qs();

    page = page ? page : 1;

    if (!perPage) {
      return response.badRequest();
    }

    const conversations = await Conversation.query()
      .where({ user_id_one: auth.user!.id })
      .orWhere({ user_id_two: auth.user!.id })
      .paginate(page, perPage);

    const queries = conversations.toJSON().data.map(async (conversation) => {
      await conversation.load("userOne", (query) => {
        query.whereNot({ id: auth.user!.id });
        query.preload("avatar");
      });
      await conversation.load("userTwo", (query) => {
        query.whereNot({ id: auth.user!.id });
        query.preload("avatar");
      });
      const blocked =
        conversation.userIdOne === auth.user!.id
          ? await Database.query()
              .from("user_blocks")
              .where({
                user_id: conversation.userIdTwo,
                blocked_user_id: conversation.userIdOne
              })
              .first()
          : await Database.query()
              .from("user_blocks")
              .where({
                user_id: conversation.userIdOne,
                blocked_user_id: conversation.userIdTwo
              })
              .first();

      const isBlocked =
        conversation.userIdTwo === auth.user!.id
          ? await Database.query()
              .from("user_blocks")
              .where({
                user_id: conversation.userIdTwo,
                blocked_user_id: conversation.userIdOne
              })
              .first()
          : await Database.query()
              .from("user_blocks")
              .where({
                user_id: conversation.userIdOne,
                blocked_user_id: conversation.userIdTwo
              })
              .first();

      const latestMessage = await conversation
        .related("messages")
        .query()
        .orderBy("created_at", "desc")
        .first();

      if (latestMessage) {
        await latestMessage.load("owner");
      }

      if (latestMessage && latestMessage.category === "media") {
        await latestMessage.load("media");
      }

      conversation.$extras.blocked = !!blocked;
      conversation.$extras.isBlocked = !!isBlocked;
      conversation.$extras.latestMessage = latestMessage;

      const conversationInJSON = conversation.toJSON();

      conversationInJSON.user =
        conversationInJSON.userOne || conversationInJSON.userTwo;

      delete conversationInJSON["userOne"];
      delete conversationInJSON["userTwo"];

      return conversationInJSON;
    });

    conversations.toJSON().data = await Promise.all(queries);

    return conversations;
  }

  public async store({ request, response, auth }: HttpContextContract) {
    const { userId } = await request.validate(StoreValidator);
    const user = auth.user!;

    const condition = [
      await Database.query()
        .from("user_blocks")
        .where({ user_id: user.id, blocked_user_id: userId })
        .first(),
      await Database.query()
        .from("user_blocks")
        .where({ user_id: userId, blocked_user_id: user.id })
        .first(),
      await Database.query()
        .from("conversations")
        .where({ user_id_one: user.id, user_id_two: userId })
        .orWhere({ user_id_one: userId, user_id_two: user.id })
        .first(),
      !(await Database.query()
        .from("friendships")
        .where({ user_id: user.id, friend_id: userId })
        .first())
    ].some((condition) => condition);

    if (condition) {
      return response.badRequest();
    }

    const conversation = await Conversation.create({
      userIdOne: user.id,
      userIdTwo: userId
    });

    const conversationInJSON = conversation.toJSON();

    conversationInJSON.user =
      conversationInJSON.userOne || conversationInJSON.userTwo;

    delete conversationInJSON["userOne"];
    delete conversationInJSON["userTwo"];

    return conversationInJSON;
  }

  public async show({ response, params, auth }: HttpContextContract) {
    const conversation = await Conversation.findOrFail(params.id);

    if (
      ![conversation.userIdOne, conversation.userIdTwo].includes(auth.user!.id)
    ) {
      return response.badRequest();
    }

    await conversation.load("userOne", (query) => {
      query.whereNot({ id: auth.user!.id });
      query.preload("avatar");
    });

    await conversation.load("userTwo", (query) => {
      query.whereNot({ id: auth.user!.id });
      query.preload("avatar");
    });

    const blocked =
      conversation.userIdOne === auth.user!.id
        ? await Database.query()
            .from("user_blocks")
            .where({
              user_id: conversation.userIdTwo,
              blocked_user_id: conversation.userIdOne
            })
            .first()
        : await Database.query()
            .from("user_blocks")
            .where({
              user_id: conversation.userIdOne,
              blocked_user_id: conversation.userIdTwo
            })
            .first();

    const isBlocked =
      conversation.userIdTwo === auth.user!.id
        ? await Database.query()
            .from("user_blocks")
            .where({
              user_id: conversation.userIdTwo,
              blocked_user_id: conversation.userIdOne
            })
            .first()
        : await Database.query()
            .from("user_blocks")
            .where({
              user_id: conversation.userIdOne,
              blocked_user_id: conversation.userIdTwo
            })
            .first();

    const latestMessage = await conversation
      .related("messages")
      .query()
      .orderBy("created_at", "desc")
      .first();

    if (latestMessage) {
      await latestMessage.load("owner");
    }

    if (latestMessage && latestMessage.category === "media") {
      await latestMessage.load("media");
    }

    conversation.$extras.blocked = !!blocked;
    conversation.$extras.isBlocked = !!isBlocked;
    conversation.$extras.latestMessage = latestMessage;

    const conversationInJSON = conversation.toJSON();

    conversationInJSON.user =
      conversationInJSON.userOne || conversationInJSON.userTwo;

    delete conversationInJSON["userOne"];
    delete conversationInJSON["userTwo"];

    return conversationInJSON;
  }
}

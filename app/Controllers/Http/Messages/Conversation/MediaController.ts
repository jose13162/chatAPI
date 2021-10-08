import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { Conversation } from "App/Models";
import { StoreValidator } from "App/Validators/Message/Private/Media";
import Application from "@ioc:Adonis/Core/Application";
import Database from "@ioc:Adonis/Lucid/Database";

export default class MediaController {
  public async store({ request, response, params, auth }: HttpContextContract) {
    const { file } = await request.validate(StoreValidator);
    const user = auth.user!;

    const isBlocked = await Database.query()
      .from("user_blocks")
      .where({ user_id: params.id, blocked_user_id: user.id })
      .orWhere({ user_id: user.id, blocked_user_id: params.id })
      .first();

    if (isBlocked) {
      return response.badRequest();
    }

    const conversation = await Conversation.findOrFail(params.id);

    if (![conversation.userIdOne, conversation.userIdTwo].includes(user.id)) {
      return response.badRequest();
    }

    const friendship = await Database.query()
      .from("friendships")
      .where({
        user_id: conversation.userIdOne,
        friend_id: conversation.userIdTwo
      })
      .first();

    if (!friendship) {
      return response.badRequest();
    }

    const message = await conversation
      .related("messages")
      .create({ userId: user.id, category: "media" });

    const mediaFile = await message.related("media").create({
      fileCategory: "media",
      fileName: `${new Date().getTime()}.${file.extname}`
    });

    await file.move(Application.tmpPath("uploads"), {
      name: mediaFile.fileName,
      overwrite: true
    });

    await message.load("owner", (owner) => {
      owner.preload("avatar");
    });

    await message.load("media");

    return message;
  }
}

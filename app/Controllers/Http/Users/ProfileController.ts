import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { UpdateValidator } from "App/Validators/Users/Profile";

export default class ProfilesController {
  public async show({ auth }: HttpContextContract) {
    const user = auth.user!;

    await user.load("avatar");

    return user;
  }

  public async update({ request, auth }: HttpContextContract) {
    const data = await request.validate(UpdateValidator);
    const user = auth.user!;

    user.merge(data);
    await user.save();

    await user.load("avatar");

    return user;
  }
}

import {Plugin, PluginConfigService} from "@wocker/core";
import {RedisController} from "./controller/RedisController";
import {RedisService} from "./services/RedisService";


@Plugin({
    name: "redis",
    controllers: [RedisController],
    providers: [
        PluginConfigService,
        RedisService
    ]
})
export default class RedisPlugin {}

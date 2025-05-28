import { bootstrapApplication } from "@angular/platform-browser";
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from "@angular/router";
import { IonicRouteStrategy, provideIonicAngular } from "@ionic/angular/standalone";
import { TranslateLoader, TranslateModule } from "@ngx-translate/core";

import { HttpClient, provideHttpClient } from "@angular/common/http";
import { importProvidersFrom, inject, provideAppInitializer } from "@angular/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { PageTransitionAnimation } from "./app/animations/page-transition.animation";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { AppService } from "./app/services/app/app.service";

bootstrapApplication(AppComponent, {
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular({
            navAnimation: PageTransitionAnimation,
            innerHTMLTemplatesEnabled: true,
            mode: "md",
        }),
        provideRouter(routes, withPreloading(PreloadAllModules)),
        provideHttpClient(),
        importProvidersFrom([
            TranslateModule.forRoot({
                defaultLanguage: "en",
                loader: {
                    provide: TranslateLoader,
                    useFactory: (http: HttpClient) => new TranslateHttpLoader(http),
                    deps: [HttpClient],
                },
            }),
        ]),
        provideAppInitializer(() => inject(AppService).InitializeApp()),
    ],
}).catch(e => console.error("Error in main.ts", e));

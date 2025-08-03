import { provideHttpClient } from "@angular/common/http";
import { inject, provideAppInitializer } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from "@angular/router";
import { IonicRouteStrategy, provideIonicAngular } from "@ionic/angular/standalone";
import { provideTranslateService } from "@ngx-translate/core";
import { provideTranslateHttpLoader } from "@ngx-translate/http-loader";
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
        provideTranslateService({
            fallbackLang: "en",
            loader: provideTranslateHttpLoader({
                prefix: "/assets/i18n/",
                suffix: ".json",
            }),
        }),
        provideAppInitializer(() => inject(AppService).InitializeApp()),
    ],
}).catch(e => console.error("Error in main.ts", e));

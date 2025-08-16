import { provideHttpClient } from "@angular/common/http";
import { inject, isDevMode, provideAppInitializer } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from "@angular/router";
import { IonicRouteStrategy, provideIonicAngular } from "@ionic/angular/standalone";
import { provideTransloco } from "@jsverse/transloco";
import { PageTransitionAnimation } from "./app/animations/page-transition.animation";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { AppService } from "./app/services/app/app.service";
import { HttpLoader } from "./app/services/localization/transloco-loader";

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
        provideTransloco({
            config: {
                reRenderOnLangChange: true,
                fallbackLang: undefined,
                defaultLang: undefined,
                scopes: {
                    keepCasing: true,
                },
                missingHandler: {
                    useFallbackTranslation: false,
                    logMissingKey: true,
                    allowEmpty: true,
                },
                prodMode: !isDevMode(),
                flatten: {
                    aot: false,
                },
            },
            loader: HttpLoader,
        }),
        provideAppInitializer(() => inject(AppService).InitializeApp()),
    ],
}).catch(e => console.error("Error in main.ts", e));

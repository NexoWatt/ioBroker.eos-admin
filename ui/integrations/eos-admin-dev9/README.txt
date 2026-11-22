NexoWatt EOS dev9 / UI 1.0.37 – begrenzter Integrationsbaustein

Anleitung, Voraussetzungen und Nachweisgrenzen:
  docs/integrations/EOS_ADMIN_DEV9_UI_LOGIN_DE.md

apply-ui-login.cjs arbeitet standardmäßig ausschließlich lesend.
Eine ausdrückliche Anwendung benötigt einen exakt passenden Quellstand,
eine Instanznummer und einen zuvor eingerichteten gemeinsamen HTTPS-Proxy.
Es werden keine Dienste gestartet und keine Pakete installiert.

ui-login-instance-0.patch ist der prüfbare Diff für Instanz 0. Nicht blind mit
einem Patchwerkzeug anwenden: Der beigefügte Applier prüft die Originalhashes
beider Dateien, erstellt vorher Sicherungen und verweigert fremde Quellstände.

# This image is created for the https://flow.frankframework.org demo.
FROM nexus.frankframework.org/frank-framework:latest

ENV dtap.stage="LOC"
ENV database.instance.name="frank2frankflow"
ENV database.name="database"
ENV CATALINA_OPTS="-Dinstance.name=Frank2FrankFlow -Dfrank-flow.context-path="

COPY --chown=tomcat ./frank-flow/src/frontend/cypress/Frank/src/main/ /opt/frank/
COPY --chown=tomcat ./context.xml /usr/local/tomcat/conf/context.xml
COPY --chown=tomcat ./frank-flow-webapp/target/frank-flow-webapp-0.0.0-SNAPSHOT /usr/local/tomcat/webapps/frank-flow
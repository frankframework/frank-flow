# This image is created for the https://flow.frankframework.org demo.
FROM frankframework/frankframework:latest

ENV dtap.stage="LOC"
ENV database.instance.name="frank2frankflow"
ENV database.name="database"
ENV CATALINA_OPTS="-Dinstance.name=Frank2FrankFlow"

COPY --chown=tomcat ./frontend/src/main/frontend/cypress/Frank/src/main/ /opt/frank/
COPY --chown=tomcat ./context.xml /usr/local/tomcat/conf/context.xml
COPY --chown=tomcat ./frank-flow/target/frank-flow-3.0.0-SNAPSHOT.war /usr/local/tomcat/webapps/frank-flow.war

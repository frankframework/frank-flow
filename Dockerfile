FROM eclipse-temurin:21-jre-alpine

COPY frank-flow/target/frank-flow-*.war /opt/frank-flow/frank-flow.war

EXPOSE 8080

WORKDIR /opt/frank-flow

ENTRYPOINT ["java", "-jar", "frank-flow.war"]

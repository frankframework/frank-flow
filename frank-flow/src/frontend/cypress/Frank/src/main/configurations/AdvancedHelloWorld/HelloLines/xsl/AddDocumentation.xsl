<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
	<xsl:output omit-xml-declaration="yes" indent="yes"/>

	<xsl:param name="originalMessage"/>
	<xsl:param name="validatorMessage"/>
	<xsl:param name="exampleMessage"/>
	<xsl:param name="exampleMessageAsXml"/>
	<xsl:param name="exampleMessageAsJson"/>

	<xsl:template match="/">
		<xsl:copy>
			<xsl:apply-templates/>
		</xsl:copy>
		<xsl:comment>
			<xsl:value-of select="'&#10;&#10;'"/>
			<xsl:value-of select="'HelloLines calls the HelloWorld adapter for every line in the input message.'"/>
			<xsl:value-of select="'&#10;'"/>
			<xsl:value-of select="'The input message can be plain text, JSON, XML or SOAP.'"/>
			<xsl:value-of select="'&#10;'"/>
			<xsl:value-of select="'Use an empty message or an invalid XML or JSON message to see example input in the documentation below.'"/>
			<xsl:value-of select="'&#10;'"/>
			<xsl:value-of select="'Note that when the order of the lines in the JSON message is not correct the input validator will repair the order based on the XSD.'"/>
			<xsl:if test="string-length($originalMessage) > 0">
				<xsl:value-of select="'&#10;&#10;'"/>
				<xsl:value-of select="'Your input message was:'"/>
				<xsl:value-of select="'&#10;&#10;'"/>
				<xsl:value-of select="$originalMessage"/>
			</xsl:if>
			<xsl:choose>
				<xsl:when test="string-length($exampleMessage) > 0">
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:choose>
						<xsl:when test="string-length($originalMessage) = 0">
							<xsl:value-of select="'Your input message was empty and was replaced with the following example message:'"/>
						</xsl:when>
						<xsl:otherwise>
							<xsl:value-of select="'Your input message was invalid and was replaced with the following example message:'"/>
						</xsl:otherwise>
					</xsl:choose>
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:value-of select="$exampleMessage"/>
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:value-of select="'Example message transformed to XML:'"/>
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:value-of select="$exampleMessageAsXml"/>
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:value-of select="'Example message transformed to JSON:'"/>
					<xsl:value-of select="'&#10;&#10;'"/>
					<xsl:value-of select="$exampleMessageAsJson"/>
					<xsl:if test="string-length($validatorMessage) > 0 and string-length($originalMessage) > 0">
						<xsl:value-of select="'&#10;&#10;'"/>
						<xsl:value-of select="'Validator failure reason:'"/>
						<xsl:value-of select="$validatorMessage"/>
					</xsl:if>
				</xsl:when>
			</xsl:choose>
			<xsl:value-of select="'&#10;&#10;'"/>
		</xsl:comment>
	</xsl:template>

	<xsl:template match="*|@*|comment()|processing-instruction()|text()">
		<xsl:copy>
			<xsl:apply-templates/>
		</xsl:copy>
	</xsl:template>

</xsl:stylesheet>

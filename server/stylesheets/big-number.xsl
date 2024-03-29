<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

    <xsl:template match="big-number">
        <div class="article__big-number ng-inline-element o-big-number o-big-number--standard">
            <span class="o-big-number__title">
                <xsl:apply-templates select="big-number-headline" />
            </span>
            <span class="o-big-number__content">
                <xsl:apply-templates select="big-number-intro" />
            </span>
        </div>
    </xsl:template>

    <xsl:template match="big-number-headline">
        <xsl:apply-templates />
    </xsl:template>

    <xsl:template match="big-number-intro">
        <xsl:apply-templates />
    </xsl:template>

</xsl:stylesheet>

import '../styles/globals.css';
import type { AppType } from 'next/dist/shared/lib/utils';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import theme from '../styles/theme';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from '../components/layout';
import Head from 'next/head';

const MyApp: AppType = ({ Component, pageProps }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <Layout>
          <Head>
            <title>Store map</title>
            <meta name="description" content="todo" />
            <link rel="icon" href="/favicon.ico" />
          </Head>
          <ColorModeScript initialColorMode={theme.config.initialColorMode} />
          <Component {...pageProps} />
        </Layout>
      </ChakraProvider>
    </QueryClientProvider>
  );
};

export default MyApp;
